import type { TeamScorePlayerRow } from "@/components/scores/team-score-players-table";
import { prisma } from "@/lib/prisma.ts";
import {
  calculateTeamScore,
  DEFAULT_MAX_SUBSTITUTIONS
} from "@/lib/scoring/calculate-team-score.ts";
import { applyFantapuntiPenalty } from "@/lib/scoring/lineup-penalties.ts";
import { prismaDecimalToNumber } from "@/lib/server/votes/shared.ts";
import {
  getTournamentRoundLineupsStatusForLeg,
  legsForTournamentRound,
  tournamentGiornataLabel,
  type TournamentVoteLeg
} from "@/lib/server/tournaments/tournament-round-leg.ts";
import {
  LineupSource,
  SlotType,
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

function buildTeamScoreInput(options: {
  lineupPlayers: Array<{
    id: string;
    playerId: string;
    positionOrder: number;
    slotType: SlotType;
    player: {
      id: string;
      name: string;
      role: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "ATTACKER";
    };
  }>;
  rosterPlayerIds: Set<string>;
  votesByPlayerId: Map<
    string,
    {
      assists: number;
      baseVote: number | null;
      cleanSheet: number;
      goals: number;
      goalsConceded: number;
      id: string;
      isSv: boolean;
      ownGoals: number;
      penaltiesMissed: number;
      penaltiesSaved: number;
      penaltiesScored: number;
      redCards: number;
      yellowCards: number;
    }
  >;
}) {
  return {
    lineupPlayers: options.lineupPlayers.map((entry) => {
      const onRoster = options.rosterPlayerIds.has(entry.playerId);
      const vote = onRoster
        ? options.votesByPlayerId.get(entry.playerId)
        : undefined;
      return {
        lineupPlayerId: entry.id,
        playerId: entry.player.id,
        playerName: entry.player.name,
        positionOrder: entry.positionOrder,
        role: entry.player.role,
        slotType: entry.slotType,
        vote: vote
          ? {
              assists: vote.assists,
              baseVote: vote.baseVote,
              cleanSheet: vote.cleanSheet,
              goals: vote.goals,
              goalsConceded: vote.goalsConceded,
              isSv: vote.isSv,
              ownGoals: vote.ownGoals,
              penaltiesMissed: vote.penaltiesMissed,
              penaltiesSaved: vote.penaltiesSaved,
              penaltiesScored: vote.penaltiesScored,
              playerVoteId: vote.id,
              redCards: vote.redCards,
              yellowCards: vote.yellowCards
            }
          : null
      };
    }),
    maxSubstitutions: DEFAULT_MAX_SUBSTITUTIONS,
    startersCount: 5
  };
}

function mapDetailLinesToRows(
  calculation: ReturnType<typeof calculateTeamScore>,
  votesByPlayerId: Map<
    string,
    {
      assists: number;
      baseVote: number | null;
      cleanSheet: number;
      goals: number;
      goalsConceded: number;
      id: string;
      isSv: boolean;
      ownGoals: number;
      penaltiesMissed: number;
      penaltiesSaved: number;
      penaltiesScored: number;
      redCards: number;
      yellowCards: number;
    }
  >
): TeamScorePlayerRow[] {
  return calculation.detailLines.map((line) => {
    const vote = votesByPlayerId.get(line.playerId);
    return {
      countsForScore: line.countsForScore,
      finalFantavote: line.finalFantavote,
      finalType: line.finalType,
      id: line.lineupPlayerId ?? `${line.playerId}-${line.positionOrder}`,
      isSv: line.isSv,
      player: { id: line.playerId, name: line.playerName },
      positionOrder: line.positionOrder,
      replacedLineupPlayer: line.replacedStarterLineupPlayerId
        ? {
            id: line.replacedStarterLineupPlayerId,
            player: {
              id: line.replacedStarterPlayerId ?? "",
              name: line.replacedStarterPlayerName ?? "Titolare"
            }
          }
        : null,
      slotType: line.slotType,
      vote: vote
        ? {
            assists: vote.assists,
            baseVote: vote.baseVote,
            cleanSheet: vote.cleanSheet,
            goals: vote.goals,
            goalsConceded: vote.goalsConceded,
            isSv: vote.isSv,
            ownGoals: vote.ownGoals,
            penaltiesMissed: vote.penaltiesMissed,
            penaltiesSaved: vote.penaltiesSaved,
            penaltiesScored: vote.penaltiesScored,
            redCards: vote.redCards,
            yellowCards: vote.yellowCards
          }
        : line.isSv
          ? { baseVote: null, isSv: true }
          : null
    };
  });
}

export async function listPublicTournamentGiornate(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      rounds: {
        orderBy: { roundIndex: "asc" },
        select: {
          id: true,
          isFinal: true,
          name: true,
          roundIndex: true,
          lineupsStatusLeg1: true,
          lineupsStatusLeg2: true,
          fixtures: {
            select: {
              leg: true,
              status: true
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    return null;
  }

  const giornate: Array<{
    completedFixtures: number;
    giornataLabel: string;
    href: string;
    leg: TournamentVoteLeg;
    lineupsStatus: TournamentRoundLineupsStatus;
    readyOrCompleted: number;
    roundId: string;
    roundName: string;
  }> = [];

  for (const round of tournament.rounds) {
    for (const leg of legsForTournamentRound(round.isFinal)) {
      const fixtures = round.fixtures.filter((fixture) => fixture.leg === leg);
      const completedFixtures = fixtures.filter(
        (fixture) => fixture.status === TournamentFixtureStatus.COMPLETED
      ).length;
      const readyOrCompleted = fixtures.filter(
        (fixture) =>
          fixture.status === TournamentFixtureStatus.COMPLETED ||
          fixture.status === TournamentFixtureStatus.READY
      ).length;
      const lineupsStatus = getTournamentRoundLineupsStatusForLeg(round, leg);

      // Show giornata once lineups were locked or results exist (past/current).
      if (
        lineupsStatus === TournamentRoundLineupsStatus.DRAFT &&
        completedFixtures === 0
      ) {
        continue;
      }

      giornate.push({
        completedFixtures,
        giornataLabel: tournamentGiornataLabel({
          isFinal: round.isFinal,
          leg,
          roundName: round.name
        }),
        href: `/tournaments/${tournament.id}/giornate/${round.id}?leg=${leg}`,
        leg,
        lineupsStatus,
        readyOrCompleted,
        roundId: round.id,
        roundName: round.name
      });
    }
  }

  return {
    giornate,
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status
    }
  };
}

export async function getPublicTournamentGiornataData(
  tournamentId: string,
  roundId: string,
  leg: TournamentVoteLeg
) {
  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId },
    select: {
      id: true,
      isFinal: true,
      name: true,
      roundIndex: true,
      lineupsStatusLeg1: true,
      lineupsStatusLeg2: true,
      tournament: {
        select: {
          id: true,
          name: true,
          status: true
        }
      },
      fixtures: {
        where: { leg },
        orderBy: [{ bracketSlot: "asc" }, { leg: "asc" }],
        select: {
          id: true,
          awayFantapunti: true,
          awayGoals: true,
          awayTeamId: true,
          bracketSlot: true,
          homeFantapunti: true,
          homeGoals: true,
          homeTeamId: true,
          seriesKey: true,
          status: true,
          awayTeam: { select: { id: true, name: true } },
          homeTeam: { select: { id: true, name: true } },
          lineups: {
            select: {
              fantasyTeamId: true,
              source: true,
              fantasyTeam: {
                select: {
                  roster: { select: { playerId: true } }
                }
              },
              players: {
                orderBy: [{ slotType: "asc" }, { positionOrder: "asc" }],
                select: {
                  id: true,
                  playerId: true,
                  positionOrder: true,
                  slotType: true,
                  player: {
                    select: {
                      id: true,
                      name: true,
                      role: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!round) {
    return null;
  }

  if (round.isFinal && leg !== 1) {
    return null;
  }

  const lineupsStatus = getTournamentRoundLineupsStatusForLeg(round, leg);
  const votes = await prisma.tournamentPlayerVote.findMany({
    where: { roundId, leg },
    select: {
      assists: true,
      baseVote: true,
      cleanSheet: true,
      goals: true,
      goalsConceded: true,
      id: true,
      isSv: true,
      ownGoals: true,
      penaltiesMissed: true,
      penaltiesSaved: true,
      penaltiesScored: true,
      playerId: true,
      redCards: true,
      yellowCards: true
    }
  });

  const votesByPlayerId = new Map(
    votes.map((vote) => [
      vote.playerId,
      {
        assists: vote.assists,
        baseVote: prismaDecimalToNumber(vote.baseVote),
        cleanSheet: vote.cleanSheet,
        goals: vote.goals,
        goalsConceded: vote.goalsConceded,
        id: vote.id,
        isSv: vote.isSv,
        ownGoals: vote.ownGoals,
        penaltiesMissed: vote.penaltiesMissed,
        penaltiesSaved: vote.penaltiesSaved,
        penaltiesScored: vote.penaltiesScored,
        redCards: vote.redCards,
        yellowCards: vote.yellowCards
      }
    ])
  );

  const resultsPublished = round.fixtures.some(
    (fixture) => fixture.status === TournamentFixtureStatus.COMPLETED
  );

  const fixtures = round.fixtures.map((fixture) => {
    const homeLineup = fixture.lineups.find(
      (lineup) => lineup.fantasyTeamId === fixture.homeTeamId
    );
    const awayLineup = fixture.lineups.find(
      (lineup) => lineup.fantasyTeamId === fixture.awayTeamId
    );

    function scoreSide(lineup: (typeof fixture.lineups)[number] | undefined) {
      if (!lineup || !resultsPublished) {
        return null;
      }

      const rosterPlayerIds = new Set(
        lineup.fantasyTeam.roster.map((entry) => entry.playerId)
      );
      const calculation = calculateTeamScore(
        buildTeamScoreInput({
          lineupPlayers: lineup.players,
          rosterPlayerIds,
          votesByPlayerId
        })
      );
      const { netScore, fantapuntiPenalty } = applyFantapuntiPenalty(
        calculation.totalScore,
        lineup.source === LineupSource.AUTO_CARRIED
      );

      return {
        fantapuntiPenalty,
        players: mapDetailLinesToRows(calculation, votesByPlayerId),
        totalScore: netScore
      };
    }

    return {
      awayGoals: resultsPublished ? fixture.awayGoals : null,
      awayScore: scoreSide(awayLineup),
      awayTeam: fixture.awayTeam,
      homeGoals: resultsPublished ? fixture.homeGoals : null,
      homeScore: scoreSide(homeLineup),
      homeTeam: fixture.homeTeam,
      id: fixture.id,
      persistedAwayFantapunti: resultsPublished
        ? prismaDecimalToNumber(fixture.awayFantapunti)
        : null,
      persistedHomeFantapunti: resultsPublished
        ? prismaDecimalToNumber(fixture.homeFantapunti)
        : null,
      status: fixture.status
    };
  });

  return {
    fixtures,
    giornataLabel: tournamentGiornataLabel({
      isFinal: round.isFinal,
      leg,
      roundName: round.name
    }),
    leg,
    lineupsStatus,
    resultsPublished,
    round: {
      id: round.id,
      isFinal: round.isFinal,
      name: round.name
    },
    tournament: round.tournament
  };
}
