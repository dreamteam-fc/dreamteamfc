import { FantasyFixtureStatus, MatchdayStatus } from "@prisma/client";

import { withSessionPrisma } from "../../prisma-session.ts";
import {
  generateRoundRobinSchedule,
  type RoundRobinMode
} from "./generate-round-robin-schedule.ts";

export type GenerateLeagueScheduleInput = {
  leagueId: string;
  mode: RoundRobinMode;
};

export type GenerateLeagueScheduleResult = {
  byeCount: number;
  fixtureCount: number;
  matchdayCount: number;
  mode: RoundRobinMode;
};

export async function generateLeagueSchedule(
  input: GenerateLeagueScheduleInput
): Promise<GenerateLeagueScheduleResult> {
  // Interactive tx (18 matchdays + createMany): must use Session/DIRECT_URL
  // when DATABASE_URL is Transaction pooler — see lib/prisma-session.ts.
  return withSessionPrisma((db) =>
    db.$transaction(async (tx) => {
      const league = await tx.league.findUnique({
        where: {
          id: input.leagueId
        },
        select: {
          _count: {
            select: {
              fantasyTeams: true,
              matchdays: true
            }
          },
          id: true,
          matchdays: {
            select: {
              id: true
            },
            take: 1
          },
          name: true
        }
      });

      if (!league) {
        throw new Error("Lega non trovata.");
      }

      const teams = await tx.fantasyTeam.findMany({
        where: {
          leagueId: league.id
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true
        }
      });

      if (teams.length < 2) {
        throw new Error("Servono almeno 2 squadre per generare il calendario.");
      }

      if (input.mode !== "DOUBLE_ROUND") {
        throw new Error(
          "Il campionato supporta solo andata e ritorno (18 giornate con 10 squadre)."
        );
      }

      if (teams.length !== 10) {
        throw new Error(
          `Per il campionato servono esattamente 10 squadre (ora: ${teams.length}).`
        );
      }

      const existingFixture = await tx.fantasyFixture.findFirst({
        where: {
          matchday: {
            leagueId: league.id
          }
        },
        select: {
          id: true
        }
      });

      if (league._count.matchdays > 0 || existingFixture) {
        throw new Error("Calendario già generato o giornate già presenti.");
      }

      const rounds = generateRoundRobinSchedule({
        mode: input.mode,
        teamIds: teams.map((team) => team.id)
      });

      let fixtureCount = 0;
      let byeCount = 0;

      for (const round of rounds) {
        const matchday = await tx.matchday.create({
          data: {
            leagueId: league.id,
            number: round.roundNumber,
            status: MatchdayStatus.DRAFT
          },
          select: {
            id: true
          }
        });

        if (round.byeTeamId) {
          byeCount += 1;
        }

        if (round.fixtures.length > 0) {
          await tx.fantasyFixture.createMany({
            data: round.fixtures.map((fixture) => ({
              awayTeamId: fixture.awayTeamId,
              homeTeamId: fixture.homeTeamId,
              matchdayId: matchday.id,
              status: FantasyFixtureStatus.SCHEDULED
            }))
          });
        }

        fixtureCount += round.fixtures.length;
      }

      return {
        byeCount,
        fixtureCount,
        matchdayCount: rounds.length,
        mode: input.mode
      };
    })
  );
}
