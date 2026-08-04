import { TournamentFixtureStatus, TournamentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { applySeriesWinner } from "@/lib/server/tournaments/record-tournament-result.ts";
import { resolveSeriesWinner } from "@/lib/tournaments/resolve-series-winner.ts";
import { prismaDecimalToNumber } from "@/lib/server/votes/shared.ts";

export async function pickTournamentSeriesWinner(options: {
  seriesKey: string;
  tournamentId: string;
  winnerTeamId: string;
}) {
  const round = await prisma.tournamentRound.findFirst({
    where: {
      tournamentId: options.tournamentId,
      fixtures: {
        some: { seriesKey: options.seriesKey }
      }
    },
    select: {
      id: true,
      isFinal: true,
      name: true,
      tournament: {
        select: {
          id: true,
          status: true
        }
      },
      fixtures: {
        where: { seriesKey: options.seriesKey },
        orderBy: { leg: "asc" },
        select: {
          awayFantapunti: true,
          awayGoals: true,
          awayTeamId: true,
          homeFantapunti: true,
          homeGoals: true,
          homeTeamId: true,
          leg: true,
          seriesWinnerTeamId: true,
          status: true
        }
      }
    }
  });

  if (!round) {
    throw new Error("Serie non trovata in questo torneo.");
  }

  if (
    round.tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    round.tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new Error("Selezione vincitore non consentita in questo stato.");
  }

  const expectedLegs = round.isFinal ? 1 : 2;
  if (round.fixtures.length !== expectedLegs) {
    throw new Error("Serie incompleta nel tabellone.");
  }

  if (
    round.fixtures.some(
      (fixture) =>
        fixture.status !== TournamentFixtureStatus.COMPLETED ||
        fixture.homeGoals == null ||
        fixture.awayGoals == null ||
        !fixture.homeTeamId ||
        !fixture.awayTeamId
    )
  ) {
    throw new Error(
      "Puoi scegliere il vincitore solo dopo aver completato entrambe le gambe della serie."
    );
  }

  if (round.fixtures.some((fixture) => fixture.seriesWinnerTeamId != null)) {
    throw new Error("Questa serie ha gia un vincitore.");
  }

  const entries = await prisma.tournamentTeamEntry.findMany({
    where: { tournamentId: options.tournamentId },
    select: {
      fantasyTeamId: true,
      seedFantapunti: true,
      seedPoints: true
    }
  });
  const seedByTeamId = new Map(
    entries.map((entry) => [
      entry.fantasyTeamId,
      {
        seedFantapunti: prismaDecimalToNumber(entry.seedFantapunti) ?? 0,
        seedPoints: entry.seedPoints
      }
    ])
  );

  const resolved = resolveSeriesWinner({
    fixtures: round.fixtures.map((fixture) => ({
      awayFantapunti: prismaDecimalToNumber(fixture.awayFantapunti),
      awayGoals: fixture.awayGoals,
      awayTeamId: fixture.awayTeamId,
      homeFantapunti: prismaDecimalToNumber(fixture.homeFantapunti),
      homeGoals: fixture.homeGoals,
      homeTeamId: fixture.homeTeamId,
      leg: fixture.leg
    })),
    seedByTeamId
  });

  if (resolved.kind === "winner") {
    throw new Error(
      "Questa serie ha gia un vincitore automatico dalle regole di spareggio; ricalcola o resetta i risultati se serve."
    );
  }

  const teamIds = new Set(resolved.totals.map((row) => row.teamId));
  if (!teamIds.has(options.winnerTeamId)) {
    throw new Error("Seleziona una delle due squadre della serie.");
  }

  const result = await applySeriesWinner({
    roundId: round.id,
    seriesKey: options.seriesKey,
    tournamentId: options.tournamentId,
    winnerId: options.winnerTeamId
  });

  return {
    advanced: result.advanced,
    roundName: round.name,
    seriesKey: options.seriesKey,
    tournamentId: options.tournamentId,
    winnerId: options.winnerTeamId
  };
}
