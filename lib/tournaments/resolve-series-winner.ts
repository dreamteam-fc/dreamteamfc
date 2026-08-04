export type SeriesFixtureScore = {
  awayFantapunti: number | null;
  awayGoals: number | null;
  awayTeamId: string | null;
  homeFantapunti: number | null;
  homeGoals: number | null;
  homeTeamId: string | null;
  leg: number;
};

export type SeriesTeamSeed = {
  seedFantapunti: number;
  seedPoints: number;
};

export type SeriesTeamTotals = {
  goals: number;
  fantapunti: number;
  seedFantapunti: number;
  seedPoints: number;
  teamId: string;
};

export type ResolveSeriesWinnerResult =
  | {
      kind: "winner";
      totals: [SeriesTeamTotals, SeriesTeamTotals];
      winnerId: string;
    }
  | {
      kind: "tied";
      totals: [SeriesTeamTotals, SeriesTeamTotals];
    };

function scoreForTeam(
  fixture: SeriesFixtureScore,
  teamId: string,
  kind: "goals" | "fantapunti"
): number {
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    return 0;
  }

  if (kind === "goals") {
    if (fixture.homeGoals == null || fixture.awayGoals == null) {
      return 0;
    }
    if (fixture.homeTeamId === teamId) {
      return fixture.homeGoals;
    }
    if (fixture.awayTeamId === teamId) {
      return fixture.awayGoals;
    }
    return 0;
  }

  const homeFp = fixture.homeFantapunti ?? 0;
  const awayFp = fixture.awayFantapunti ?? 0;
  if (fixture.homeTeamId === teamId) {
    return homeFp;
  }
  if (fixture.awayTeamId === teamId) {
    return awayFp;
  }
  return 0;
}

export function aggregateSeriesGoals(
  fixtures: SeriesFixtureScore[],
  teamId: string
): number {
  return fixtures.reduce(
    (total, fixture) => total + scoreForTeam(fixture, teamId, "goals"),
    0
  );
}

export function aggregateSeriesFantapunti(
  fixtures: SeriesFixtureScore[],
  teamId: string
): number {
  return fixtures.reduce(
    (total, fixture) => total + scoreForTeam(fixture, teamId, "fantapunti"),
    0
  );
}

function buildTotals(
  fixtures: SeriesFixtureScore[],
  teamId: string,
  seed: SeriesTeamSeed
): SeriesTeamTotals {
  return {
    fantapunti: aggregateSeriesFantapunti(fixtures, teamId),
    goals: aggregateSeriesGoals(fixtures, teamId),
    seedFantapunti: seed.seedFantapunti,
    seedPoints: seed.seedPoints,
    teamId
  };
}

/**
 * Winner of andata+ritorno (or single final leg):
 * 1) more goals across legs
 * 2) more fantapunti across legs
 * 3) higher seedPoints (league pts at entry)
 * 4) higher seedFantapunti (league FP at entry)
 * else unresolved (admin must pick).
 */
export function resolveSeriesWinner(options: {
  fixtures: SeriesFixtureScore[];
  seedByTeamId: Map<string, SeriesTeamSeed>;
}): ResolveSeriesWinnerResult {
  const { fixtures, seedByTeamId } = options;
  const first = fixtures[0];

  if (!first?.homeTeamId || !first.awayTeamId) {
    throw new Error("Serie incompleta: mancano le squadre.");
  }

  const teamA = first.homeTeamId;
  const teamB = first.awayTeamId;

  for (const fixture of fixtures) {
    if (fixture.homeGoals == null || fixture.awayGoals == null) {
      throw new Error("Serie incompleta: mancano ancora dei risultati.");
    }
  }

  const seedA = seedByTeamId.get(teamA) ?? {
    seedFantapunti: 0,
    seedPoints: 0
  };
  const seedB = seedByTeamId.get(teamB) ?? {
    seedFantapunti: 0,
    seedPoints: 0
  };

  const totalsA = buildTotals(fixtures, teamA, seedA);
  const totalsB = buildTotals(fixtures, teamB, seedB);
  const totals: [SeriesTeamTotals, SeriesTeamTotals] = [totalsA, totalsB];

  if (totalsA.goals !== totalsB.goals) {
    return {
      kind: "winner",
      totals,
      winnerId: totalsA.goals > totalsB.goals ? teamA : teamB
    };
  }

  if (totalsA.fantapunti !== totalsB.fantapunti) {
    return {
      kind: "winner",
      totals,
      winnerId: totalsA.fantapunti > totalsB.fantapunti ? teamA : teamB
    };
  }

  if (totalsA.seedPoints !== totalsB.seedPoints) {
    return {
      kind: "winner",
      totals,
      winnerId: totalsA.seedPoints > totalsB.seedPoints ? teamA : teamB
    };
  }

  if (totalsA.seedFantapunti !== totalsB.seedFantapunti) {
    return {
      kind: "winner",
      totals,
      winnerId:
        totalsA.seedFantapunti > totalsB.seedFantapunti ? teamA : teamB
    };
  }

  return { kind: "tied", totals };
}
