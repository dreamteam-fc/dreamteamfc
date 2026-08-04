import { TournamentStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type ResetTournamentToEntriesSummary = {
  deletedFixtures: number;
  deletedLineupPlayers: number;
  deletedLineups: number;
  deletedPlayerVotes: number;
  deletedRequiredVotes: number;
  deletedRounds: number;
  entryCountKept: number;
  lineupsOpenAfter: boolean;
  lineupsOpenBefore: boolean;
  tournamentId: string;
  tournamentName: string;
  tournamentStatusAfter: TournamentStatus;
  tournamentStatusBefore: TournamentStatus;
};

type ResolveOptions = {
  /** Prefer this id when present (prior cleanup target). */
  preferredTournamentId?: string;
  /** Case-insensitive exact name match (default: "prova"). */
  tournamentName?: string;
  /** Explicit tournament id. */
  tournamentId?: string;
};

const ACTIVE_STATUSES: TournamentStatus[] = [
  TournamentStatus.BRACKET_GENERATED,
  TournamentStatus.IN_PROGRESS
];

async function resolveTournament(options: ResolveOptions) {
  if (options.tournamentId) {
    const byId = await prisma.tournament.findUnique({
      where: { id: options.tournamentId },
      select: {
        id: true,
        lineupsOpen: true,
        name: true,
        status: true,
        _count: { select: { entries: true } }
      }
    });

    if (!byId) {
      throw new Error(`Torneo ${options.tournamentId} non trovato.`);
    }

    return byId;
  }

  const preferredId = options.preferredTournamentId?.trim();
  if (preferredId) {
    const preferred = await prisma.tournament.findUnique({
      where: { id: preferredId },
      select: {
        id: true,
        lineupsOpen: true,
        name: true,
        status: true,
        _count: { select: { entries: true } }
      }
    });

    if (preferred && preferred.status !== TournamentStatus.COMPLETED) {
      return preferred;
    }
  }

  const name = (options.tournamentName ?? "prova").trim();
  const byName = await prisma.tournament.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      status: { not: TournamentStatus.COMPLETED }
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      lineupsOpen: true,
      name: true,
      status: true,
      _count: { select: { entries: true } }
    }
  });

  if (byName.length === 1) {
    return byName[0]!;
  }

  if (byName.length > 1) {
    const activeNamed = byName.find((tournament) =>
      ACTIVE_STATUSES.includes(tournament.status)
    );
    if (activeNamed) {
      return activeNamed;
    }
    return byName[0]!;
  }

  const active = await prisma.tournament.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      lineupsOpen: true,
      name: true,
      status: true,
      _count: { select: { entries: true } }
    }
  });

  if (active.length === 1) {
    return active[0]!;
  }

  if (active.length > 1) {
    throw new Error(
      `Trovati ${active.length} tornei attivi (BRACKET_GENERATED / IN_PROGRESS). Specifica --tournamentId= o --name=.`
    );
  }

  throw new Error(
    `Nessun torneo "${name}" non-COMPLETED e nessun torneo attivo trovato.`
  );
}

/**
 * Wipe tournament bracket / runtime data back to ENTRIES_SET.
 *
 * Keeps Tournament + TournamentTeamEntry (seedPoints / seedRank / activation).
 * Deletes rounds, fixtures, lineups, votes, required votes, and clears
 * lineupsOpen. Does not touch League / FantasyTeam / league scores.
 *
 * Sequential autocommit deletes (no interactive $transaction) for PgBouncer
 * safety — same pattern as reset-league-data / reset-tournament-round-results.
 */
export async function resetTournamentToEntries(
  options: ResolveOptions = {}
): Promise<ResetTournamentToEntriesSummary> {
  const tournament = await resolveTournament(options);

  if (tournament.status === TournamentStatus.COMPLETED) {
    throw new Error(
      `Torneo "${tournament.name}" e COMPLETED: reset a ENTRIES_SET non supportato.`
    );
  }

  if (tournament.status === TournamentStatus.DRAFT) {
    throw new Error(
      `Torneo "${tournament.name}" e ancora DRAFT (nessuna entry/roster da preservare in questo flusso).`
    );
  }

  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true }
  });
  const roundIds = rounds.map((round) => round.id);

  const fixtures =
    roundIds.length === 0
      ? []
      : await prisma.tournamentFixture.findMany({
          where: { roundId: { in: roundIds } },
          select: { id: true }
        });
  const fixtureIds = fixtures.map((fixture) => fixture.id);

  const lineups =
    fixtureIds.length === 0
      ? []
      : await prisma.tournamentLineup.findMany({
          where: { tournamentFixtureId: { in: fixtureIds } },
          select: { id: true }
        });
  const lineupIds = lineups.map((lineup) => lineup.id);

  let deletedLineupPlayers = 0;
  if (lineupIds.length > 0) {
    const result = await prisma.tournamentLineupPlayer.deleteMany({
      where: { lineupId: { in: lineupIds } }
    });
    deletedLineupPlayers = result.count;
  }

  let deletedLineups = 0;
  if (fixtureIds.length > 0) {
    const result = await prisma.tournamentLineup.deleteMany({
      where: { tournamentFixtureId: { in: fixtureIds } }
    });
    deletedLineups = result.count;
  }

  let deletedPlayerVotes = 0;
  let deletedRequiredVotes = 0;
  if (roundIds.length > 0) {
    const votes = await prisma.tournamentPlayerVote.deleteMany({
      where: { roundId: { in: roundIds } }
    });
    deletedPlayerVotes = votes.count;

    const required = await prisma.tournamentRequiredVotePlayer.deleteMany({
      where: { roundId: { in: roundIds } }
    });
    deletedRequiredVotes = required.count;
  }

  let deletedFixtures = 0;
  if (roundIds.length > 0) {
    const result = await prisma.tournamentFixture.deleteMany({
      where: { roundId: { in: roundIds } }
    });
    deletedFixtures = result.count;
  }

  const deletedRoundsResult = await prisma.tournamentRound.deleteMany({
    where: { tournamentId: tournament.id }
  });

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      lineupsOpen: false,
      status: TournamentStatus.ENTRIES_SET
    }
  });

  const entriesKept = await prisma.tournamentTeamEntry.count({
    where: { tournamentId: tournament.id }
  });

  return {
    deletedFixtures,
    deletedLineupPlayers,
    deletedLineups,
    deletedPlayerVotes,
    deletedRequiredVotes,
    deletedRounds: deletedRoundsResult.count,
    entryCountKept: entriesKept,
    lineupsOpenAfter: false,
    lineupsOpenBefore: tournament.lineupsOpen,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentStatusAfter: TournamentStatus.ENTRIES_SET,
    tournamentStatusBefore: tournament.status
  };
}
