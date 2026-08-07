import { LineupSource, LineupStatus, TournamentFixtureStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  assertTournamentLineupLeg,
  type TournamentVoteLeg
} from "@/lib/server/tournaments/tournament-round-leg.ts";

export type AutoCarryTournamentRoundLineupsResult = {
  carried: number;
  leg: TournamentVoteLeg;
  roundId: string;
  stillMissing: number;
};

type SideJob = {
  fantasyTeamId: string;
  tournamentFixtureId: string;
};

/**
 * At tournament lineup lock: copy last USER/COACH lineup in the same tournament
 * (strictly earlier roundIndex, or same round with lower leg).
 */
export async function autoCarryMissingTournamentRoundLineups(
  roundId: string,
  leg: number
): Promise<AutoCarryTournamentRoundLineupsResult> {
  assertTournamentLineupLeg(leg);

  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      roundIndex: true,
      tournamentId: true,
      fixtures: {
        where: {
          status: TournamentFixtureStatus.READY,
          leg
        },
        select: {
          id: true,
          awayTeamId: true,
          homeTeamId: true,
          lineups: {
            select: {
              fantasyTeamId: true
            }
          }
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  const jobs: SideJob[] = [];
  for (const fixture of round.fixtures) {
    const have = new Set(fixture.lineups.map((lineup) => lineup.fantasyTeamId));
    if (fixture.homeTeamId && !have.has(fixture.homeTeamId)) {
      jobs.push({
        fantasyTeamId: fixture.homeTeamId,
        tournamentFixtureId: fixture.id
      });
    }
    if (fixture.awayTeamId && !have.has(fixture.awayTeamId)) {
      jobs.push({
        fantasyTeamId: fixture.awayTeamId,
        tournamentFixtureId: fixture.id
      });
    }
  }

  if (jobs.length === 0) {
    return { carried: 0, leg, roundId: round.id, stillMissing: 0 };
  }

  let carried = 0;

  for (const job of jobs) {
    const candidates = await prisma.tournamentLineup.findMany({
      where: {
        fantasyTeamId: job.fantasyTeamId,
        source: { in: [LineupSource.USER, LineupSource.COACH] },
        players: { some: {} },
        tournamentFixture: {
          round: { tournamentId: round.tournamentId }
        }
      },
      include: {
        players: {
          select: {
            playerId: true,
            positionOrder: true,
            slotType: true
          }
        },
        tournamentFixture: {
          select: {
            leg: true,
            round: {
              select: {
                roundIndex: true
              }
            }
          }
        }
      }
    });

    const previous = candidates
      .filter((candidate) => {
        const candidateRound = candidate.tournamentFixture.round.roundIndex;
        const candidateLeg = candidate.tournamentFixture.leg;
        if (candidateRound < round.roundIndex) {
          return true;
        }
        if (candidateRound === round.roundIndex && candidateLeg < leg) {
          return true;
        }
        return false;
      })
      .sort((left, right) => {
        const roundDelta =
          right.tournamentFixture.round.roundIndex -
          left.tournamentFixture.round.roundIndex;
        if (roundDelta !== 0) {
          return roundDelta;
        }
        return right.tournamentFixture.leg - left.tournamentFixture.leg;
      })[0];

    if (!previous || previous.players.length === 0) {
      continue;
    }

    await prisma.tournamentLineup.create({
      data: {
        fantasyTeamId: job.fantasyTeamId,
        source: LineupSource.AUTO_CARRIED,
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date(),
        tournamentFixtureId: job.tournamentFixtureId,
        players: {
          create: previous.players.map((player) => ({
            playerId: player.playerId,
            positionOrder: player.positionOrder,
            slotType: player.slotType
          }))
        }
      }
    });

    carried += 1;
  }

  return {
    carried,
    leg,
    roundId: round.id,
    stillMissing: jobs.length - carried
  };
}
