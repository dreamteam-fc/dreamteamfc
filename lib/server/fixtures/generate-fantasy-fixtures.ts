import { FantasyFixtureStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type GenerateFantasyFixturesResult = {
  createdCount: number;
  matchdayId: string;
  totalFixtures: number;
};

type TeamSummary = {
  createdAt: Date;
  id: string;
  name: string;
};

function getFixtureKey(homeTeamId: string, awayTeamId: string) {
  return [homeTeamId, awayTeamId].sort().join(":");
}

function assertUniqueTeamParticipation(
  teams: TeamSummary[],
  fixtures: Array<{ awayTeamId: string; homeTeamId: string }>
) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const seenTeamIds = new Set<string>();

  for (const fixture of fixtures) {
    if (fixture.homeTeamId === fixture.awayTeamId) {
      const teamName = teamById.get(fixture.homeTeamId)?.name ?? fixture.homeTeamId;
      throw new Error(
        `Fixture non valida nella giornata: la squadra ${teamName} compare contro se stessa.`
      );
    }

    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      if (seenTeamIds.has(teamId)) {
        const teamName = teamById.get(teamId)?.name ?? teamId;
        throw new Error(
          `La squadra ${teamName} è già presente in una fixture della stessa giornata.`
        );
      }

      seenTeamIds.add(teamId);
    }
  }
}

/**
 * Pair teams into fixtures for a single matchday.
 *
 * Intentionally avoids interactive `$transaction`: a read-then-createMany
 * flow is idempotent enough (skips existing pairs) and survives Supabase
 * poolers that drop long/sticky Prisma transactions.
 */
export async function generateFantasyFixtures(
  matchdayId: string
): Promise<GenerateFantasyFixturesResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    select: {
      id: true,
      leagueId: true
    }
  });

  if (!matchday) {
    throw new Error(`Matchday ${matchdayId} not found.`);
  }

  const teams = await prisma.fantasyTeam.findMany({
    where: {
      leagueId: matchday.leagueId
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      name: true
    }
  });

  if (teams.length === 0) {
    throw new Error("Nessuna fantasy team trovata per la lega della giornata.");
  }

  if (teams.length % 2 !== 0) {
    throw new Error(
      "Numero dispari di squadre: gestione bye non ancora supportata nel MVP"
    );
  }

  const existingFixtures = await prisma.fantasyFixture.findMany({
    where: { matchdayId },
    select: {
      awayTeamId: true,
      homeTeamId: true,
      id: true
    }
  });

  assertUniqueTeamParticipation(teams, existingFixtures);

  const existingFixtureKeys = new Set(
    existingFixtures.map((fixture) =>
      getFixtureKey(fixture.homeTeamId, fixture.awayTeamId)
    )
  );
  const teamIdsAlreadyScheduled = new Set(
    existingFixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])
  );

  const fixturesToCreate: Array<{
    awayTeamId: string;
    homeTeamId: string;
    matchdayId: string;
    status: FantasyFixtureStatus;
  }> = [];

  for (let index = 0; index < teams.length; index += 2) {
    const homeTeam = teams[index];
    const awayTeam = teams[index + 1];
    const fixtureKey = getFixtureKey(homeTeam.id, awayTeam.id);

    if (existingFixtureKeys.has(fixtureKey)) {
      continue;
    }

    if (
      teamIdsAlreadyScheduled.has(homeTeam.id) ||
      teamIdsAlreadyScheduled.has(awayTeam.id)
    ) {
      const conflictingTeam = teamIdsAlreadyScheduled.has(homeTeam.id)
        ? homeTeam
        : awayTeam;
      throw new Error(
        `La squadra ${conflictingTeam.name} è già presente in una fixture della stessa giornata.`
      );
    }

    fixturesToCreate.push({
      awayTeamId: awayTeam.id,
      homeTeamId: homeTeam.id,
      matchdayId,
      status: FantasyFixtureStatus.SCHEDULED
    });

    teamIdsAlreadyScheduled.add(homeTeam.id);
    teamIdsAlreadyScheduled.add(awayTeam.id);
  }

  if (fixturesToCreate.length > 0) {
    await prisma.fantasyFixture.createMany({
      data: fixturesToCreate
    });
  }

  return {
    createdCount: fixturesToCreate.length,
    matchdayId,
    totalFixtures: teams.length / 2
  };
}
