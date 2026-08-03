import {
  LineupStatus,
  Prisma,
  SlotType,
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus,
  type PrismaClient
} from "@prisma/client";

import { getBenchPositionOrderByRole } from "../../lineups/bench-position-order.ts";
import { prisma as defaultPrisma } from "../../prisma.ts";
import {
  buildRandomValidLineupFromRoster,
  type RosterPlayerForLineup
} from "../lineups/generate-random-lineups-for-matchday.ts";
import { REQUIRED_TOTAL_LINEUP_PLAYERS } from "../lineups/validate-lineup-composition.ts";
import {
  countReadyPlayableFixtures,
  getNextUsefulTournamentRound
} from "./next-useful-tournament-round.ts";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type GenerateRandomTournamentLineupsOptions = {
  /** Optional Prisma client (scripts may pass a dedicated instance). */
  db?: PrismaClient;
  /**
   * When false, skip team/fixture slots that already have a SUBMITTED lineup with 9 players.
   * Admin UI always uses force=true.
   */
  force?: boolean;
  /** When omitted, picks the next useful round for the tournament. */
  roundId?: string;
  tournamentId: string;
};

export type GenerateRandomTournamentLineupsResult = {
  failures: Array<{
    error: string;
    fixtureId: string;
    teamId: string;
    teamName: string;
  }>;
  fixtureCount: number;
  lineupsStatus: TournamentRoundLineupsStatus;
  roundId: string;
  roundName: string;
  skipped: number;
  tournamentId: string;
  written: number;
};

type TeamSlot = {
  fantasyTeamId: string;
  fantasyTeamName: string;
  tournamentFixtureId: string;
};

async function persistSubmittedTournamentLineup(
  db: DbClient,
  options: {
    existingLineupId: string | null;
    fantasyTeamId: string;
    tournamentFixtureId: string;
    starters: RosterPlayerForLineup[];
    bench: RosterPlayerForLineup[];
  }
) {
  const lineup = options.existingLineupId
    ? await db.tournamentLineup.update({
        where: { id: options.existingLineupId },
        data: {
          status: LineupStatus.SUBMITTED,
          submittedAt: new Date()
        },
        select: { id: true }
      })
    : await db.tournamentLineup.create({
        data: {
          fantasyTeamId: options.fantasyTeamId,
          tournamentFixtureId: options.tournamentFixtureId,
          status: LineupStatus.SUBMITTED,
          submittedAt: new Date()
        },
        select: { id: true }
      });

  await db.tournamentLineupPlayer.deleteMany({
    where: { lineupId: lineup.id }
  });

  await db.tournamentLineupPlayer.createMany({
    data: [
      ...options.starters.map((player, index) => ({
        lineupId: lineup.id,
        playerId: player.id,
        positionOrder: index + 1,
        slotType: SlotType.STARTER
      })),
      ...[...options.bench]
        .sort(
          (left, right) =>
            getBenchPositionOrderByRole(left.role) -
            getBenchPositionOrderByRole(right.role)
        )
        .map((player) => ({
          lineupId: lineup.id,
          playerId: player.id,
          positionOrder: getBenchPositionOrderByRole(player.role),
          slotType: SlotType.BENCH
        }))
    ]
  });
}

/**
 * Writes random valid SUBMITTED tournament lineups for every home/away team
 * on READY fixtures of the target round (force overwrite by default).
 */
export async function generateRandomTournamentLineupsForRound(
  options: GenerateRandomTournamentLineupsOptions
): Promise<GenerateRandomTournamentLineupsResult> {
  const db = options.db ?? defaultPrisma;
  const force = options.force ?? true;

  const tournament = await db.tournament.findUnique({
    where: { id: options.tournamentId },
    select: {
      id: true,
      name: true,
      rounds: {
        orderBy: { roundIndex: "asc" },
        select: {
          id: true,
          name: true,
          roundIndex: true,
          lineupsStatus: true,
          fixtures: {
            select: {
              id: true,
              status: true,
              homeTeamId: true,
              awayTeamId: true,
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    throw new Error("Torneo non trovato.");
  }

  const targetRound = options.roundId
    ? (tournament.rounds.find((round) => round.id === options.roundId) ?? null)
    : getNextUsefulTournamentRound(tournament.rounds);

  if (!targetRound) {
    throw new Error(
      options.roundId
        ? "Fase torneo non trovata."
        : "Nessuna fase utile con partite READY (formazioni non LOCKED)."
    );
  }

  if (targetRound.lineupsStatus === TournamentRoundLineupsStatus.LOCKED) {
    throw new Error(
      `Le formazioni di ${targetRound.name} sono già chiuse (LOCKED).`
    );
  }

  const readyFixtures = targetRound.fixtures.filter(
    (fixture) =>
      fixture.status === TournamentFixtureStatus.READY &&
      fixture.homeTeamId != null &&
      fixture.awayTeamId != null &&
      fixture.homeTeam != null &&
      fixture.awayTeam != null
  );

  if (readyFixtures.length === 0) {
    throw new Error(
      `Nessuna partita READY in ${targetRound.name}: impossibile generare formazioni.`
    );
  }

  const slots: TeamSlot[] = [];
  for (const fixture of readyFixtures) {
    slots.push({
      fantasyTeamId: fixture.homeTeam!.id,
      fantasyTeamName: fixture.homeTeam!.name,
      tournamentFixtureId: fixture.id
    });
    slots.push({
      fantasyTeamId: fixture.awayTeam!.id,
      fantasyTeamName: fixture.awayTeam!.name,
      tournamentFixtureId: fixture.id
    });
  }

  const teamIds = Array.from(new Set(slots.map((slot) => slot.fantasyTeamId)));
  const teams = await db.fantasyTeam.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      name: true,
      roster: {
        select: {
          player: {
            select: {
              id: true,
              name: true,
              role: true,
              isActive: true
            }
          }
        }
      }
    }
  });
  const teamById = new Map(teams.map((team) => [team.id, team]));

  let written = 0;
  let skipped = 0;
  const failures: GenerateRandomTournamentLineupsResult["failures"] = [];

  for (const slot of slots) {
    try {
      const team = teamById.get(slot.fantasyTeamId);
      if (!team) {
        throw new Error("Squadra non trovata.");
      }

      const existing = await db.tournamentLineup.findUnique({
        where: {
          fantasyTeamId_tournamentFixtureId: {
            fantasyTeamId: slot.fantasyTeamId,
            tournamentFixtureId: slot.tournamentFixtureId
          }
        },
        select: {
          id: true,
          status: true,
          _count: { select: { players: true } }
        }
      });

      if (
        !force &&
        existing &&
        existing.status === LineupStatus.SUBMITTED &&
        existing._count.players === REQUIRED_TOTAL_LINEUP_PLAYERS
      ) {
        skipped += 1;
        continue;
      }

      const roster: RosterPlayerForLineup[] = team.roster.map(
        (entry) => entry.player
      );
      const { starters, bench } = buildRandomValidLineupFromRoster(roster);

      await db.$transaction(async (tx) => {
        await persistSubmittedTournamentLineup(tx, {
          existingLineupId: existing?.id ?? null,
          fantasyTeamId: slot.fantasyTeamId,
          tournamentFixtureId: slot.tournamentFixtureId,
          starters,
          bench
        });
      });

      written += 1;
    } catch (error) {
      failures.push({
        fixtureId: slot.tournamentFixtureId,
        teamId: slot.fantasyTeamId,
        teamName: slot.fantasyTeamName,
        error: error instanceof Error ? error.message : "Errore sconosciuto"
      });
    }
  }

  return {
    failures,
    fixtureCount: countReadyPlayableFixtures(readyFixtures),
    lineupsStatus: targetRound.lineupsStatus,
    roundId: targetRound.id,
    roundName: targetRound.name,
    skipped,
    tournamentId: tournament.id,
    written
  };
}

export function formatGenerateRandomTournamentLineupsNotice(
  result: GenerateRandomTournamentLineupsResult
): string {
  const failureSuffix =
    result.failures.length > 0
      ? ` Fallite: ${result.failures.length} (${result.failures
          .slice(0, 2)
          .map((failure) => failure.teamName)
          .join(", ")}${result.failures.length > 2 ? "…" : ""}).`
      : "";

  const statusHint =
    result.lineupsStatus === TournamentRoundLineupsStatus.DRAFT
      ? " (fase ancora DRAFT — apri le formazioni prima che gli utenti possano modificare)."
      : "";

  return `Formazioni casuali generate per ${result.roundName}: ${result.written} scritte su ${result.fixtureCount} partite READY.${failureSuffix}${statusHint}`;
}
