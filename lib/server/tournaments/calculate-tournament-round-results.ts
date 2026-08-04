import {
  SlotType,
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  isRequiredVoteCompletedStatus,
  prismaDecimalToNumber
} from "@/lib/server/votes/shared.ts";
import {
  calculateTeamScore,
  DEFAULT_MAX_SUBSTITUTIONS
} from "@/lib/scoring/calculate-team-score.ts";
import { convertScoreToGoals } from "@/lib/scoring/convert-score-to-goals.ts";
import { getFixtureForfeitOutcome } from "@/lib/server/fixtures/fixture-forfeit.ts";
import { recordTournamentFixtureResult } from "@/lib/server/tournaments/record-tournament-result.ts";
import {
  assertTournamentVoteLeg,
  tournamentVoteLegLabel
} from "@/lib/server/tournaments/tournament-votes.ts";

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
      redCards: number;
      yellowCards: number;
    }
  >;
}) {
  return {
    lineupPlayers: options.lineupPlayers.map((entry) => {
      const vote = options.votesByPlayerId.get(entry.playerId);
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

export async function calculateTournamentRoundResultsFromVotes(
  roundId: string,
  leg: number
) {
  assertTournamentVoteLeg(leg);

  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      isFinal: true,
      tournamentId: true,
      lineupsStatus: true,
      requiredVotes: {
        where: { leg },
        select: { status: true }
      },
      fixtures: {
        where: {
          leg,
          status: {
            in: [TournamentFixtureStatus.READY, TournamentFixtureStatus.COMPLETED]
          }
        },
        orderBy: [{ bracketSlot: "asc" }, { leg: "asc" }],
        select: {
          id: true,
          awayTeamId: true,
          homeTeamId: true,
          status: true,
          lineups: {
            select: {
              fantasyTeamId: true,
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
    throw new Error("Fase torneo non trovata.");
  }

  if (round.isFinal && leg !== 1) {
    throw new Error("La finale ha solo l'andata (leg 1).");
  }

  if (round.lineupsStatus !== TournamentRoundLineupsStatus.LOCKED) {
    throw new Error(
      "Calcola i risultati solo dopo aver chiuso le formazioni (LOCKED)."
    );
  }

  if (round.requiredVotes.length === 0) {
    throw new Error(
      `Genera/importa prima i voti per ${tournamentVoteLegLabel(leg).toLowerCase()} (lista voti richiesta vuota).`
    );
  }

  const pending = round.requiredVotes.filter(
    (entry) => !isRequiredVoteCompletedStatus(entry.status)
  );
  if (pending.length > 0) {
    throw new Error(
      `Ci sono ancora ${pending.length} voti richiesti incompleti per ${tournamentVoteLegLabel(leg).toLowerCase()}. Completa l'import XLS.`
    );
  }

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
        redCards: vote.redCards,
        yellowCards: vote.yellowCards
      }
    ])
  );

  const readyFixtures = round.fixtures.filter(
    (fixture) => fixture.status === TournamentFixtureStatus.READY
  );

  if (readyFixtures.length === 0) {
    throw new Error(
      `Nessuna partita READY da calcolare per ${tournamentVoteLegLabel(leg).toLowerCase()}.`
    );
  }

  let calculatedCount = 0;

  for (const fixture of readyFixtures) {
    if (!fixture.homeTeamId || !fixture.awayTeamId) {
      continue;
    }

    const homeLineup = fixture.lineups.find(
      (lineup) => lineup.fantasyTeamId === fixture.homeTeamId
    );
    const awayLineup = fixture.lineups.find(
      (lineup) => lineup.fantasyTeamId === fixture.awayTeamId
    );

    const forfeit = getFixtureForfeitOutcome({
      awayTeamScoreId: awayLineup ? "yes" : null,
      homeTeamScoreId: homeLineup ? "yes" : null
    });

    let homeGoals = 0;
    let awayGoals = 0;

    if (forfeit === "HOME_WIN_BY_FORFEIT") {
      homeGoals = 3;
      awayGoals = 0;
    } else if (forfeit === "AWAY_WIN_BY_FORFEIT") {
      homeGoals = 0;
      awayGoals = 3;
    } else if (forfeit === "DOUBLE_FORFEIT") {
      homeGoals = 0;
      awayGoals = 0;
    } else {
      const homeScore = calculateTeamScore(
        buildTeamScoreInput({
          lineupPlayers: homeLineup!.players,
          votesByPlayerId
        })
      );
      const awayScore = calculateTeamScore(
        buildTeamScoreInput({
          lineupPlayers: awayLineup!.players,
          votesByPlayerId
        })
      );

      homeGoals = convertScoreToGoals(homeScore.totalScore);
      awayGoals = convertScoreToGoals(awayScore.totalScore);
    }

    await recordTournamentFixtureResult({
      awayGoals: String(awayGoals),
      fixtureId: fixture.id,
      homeGoals: String(homeGoals)
    });
    calculatedCount += 1;
  }

  return {
    calculatedCount,
    leg,
    roundId: round.id,
    roundName: round.name,
    tournamentId: round.tournamentId
  };
}
