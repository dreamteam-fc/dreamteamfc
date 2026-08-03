import {
  LineupStatus,
  SlotType,
  TournamentFixtureStatus,
  TournamentStatus,
  type UserRole
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  getBenchPositionOrderByRole,
  validateLineupComposition
} from "@/lib/server/lineups/validate-lineup-composition.ts";
import { validateRosterComposition } from "@/lib/server/rosters/validate-roster-composition.ts";
import {
  canManageLineup,
  resolveTeamAccessRole
} from "@/lib/server/teams/team-access.ts";

type PlayerRole = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "ATTACKER";

export type TournamentLineupSelectionInput = {
  playerId: string;
  selection: "BENCH" | "NONE" | "STARTER";
};

export async function saveTournamentLineup(options: {
  appUserId: string;
  appUserRole: UserRole;
  fantasyTeamId: string;
  selections: TournamentLineupSelectionInput[];
  tournamentFixtureId: string;
}) {
  const fixture = await prisma.tournamentFixture.findUnique({
    where: { id: options.tournamentFixtureId },
    select: {
      id: true,
      awayTeamId: true,
      homeTeamId: true,
      status: true,
      round: {
        select: {
          name: true,
          tournament: {
            select: {
              id: true,
              lineupsOpen: true,
              name: true,
              status: true,
              entries: {
                where: { fantasyTeamId: options.fantasyTeamId },
                select: {
                  activatedAt: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!fixture) {
    throw new Error("Partita torneo non trovata.");
  }

  const tournament = fixture.round.tournament;
  const isParticipant =
    fixture.homeTeamId === options.fantasyTeamId ||
    fixture.awayTeamId === options.fantasyTeamId;

  if (!isParticipant) {
    throw new Error("Questa squadra non gioca questa partita.");
  }

  if (fixture.status !== TournamentFixtureStatus.READY) {
    throw new Error("Formazione modificabile solo su partite READY.");
  }

  if (!tournament.lineupsOpen) {
    throw new Error("Le formazioni del torneo sono chiuse.");
  }

  if (
    tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new Error("Torneo non in fase di formazioni.");
  }

  const entry = tournament.entries[0];
  if (!entry?.activatedAt) {
    throw new Error(
      "Sblocca prima l'accesso al torneo con la password (pagina attiva torneo)."
    );
  }

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: options.fantasyTeamId },
    select: {
      id: true,
      leagueId: true,
      userId: true,
      roster: {
        select: {
          player: {
            select: {
              id: true,
              isActive: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!team) {
    throw new Error("Squadra non trovata.");
  }

  const accessRole = await resolveTeamAccessRole({
    appUserId: options.appUserId,
    appUserRole: options.appUserRole,
    teamId: team.id,
    teamOwnerId: team.userId
  });

  if (!canManageLineup(accessRole)) {
    throw new Error("Non autorizzato.");
  }

  const rosterPlayerMap = new Map(
    team.roster.map((entry) => [entry.player.id, entry.player])
  );

  const blocked = await prisma.leagueBlockedPlayer.findMany({
    where: {
      leagueId: team.leagueId,
      playerId: { in: Array.from(rosterPlayerMap.keys()) }
    },
    select: { playerId: true }
  });
  const blockedIds = new Set(blocked.map((entry) => entry.playerId));

  const rosterComposition = validateRosterComposition(
    team.roster.map((entry) => ({
      isBlockedInLeague: blockedIds.has(entry.player.id),
      isGloballyInactive: !entry.player.isActive,
      role: entry.player.role
    }))
  );

  if (!rosterComposition.isValid) {
    throw new Error("Completa prima la rosa della squadra.");
  }

  const starters: Array<{ id: string; role: PlayerRole }> = [];
  const bench: Array<{ id: string; role: PlayerRole }> = [];

  for (const selection of options.selections) {
    const player = rosterPlayerMap.get(selection.playerId);
    if (!player) {
      continue;
    }

    if (selection.selection === "STARTER") {
      starters.push({ id: player.id, role: player.role });
    }

    if (selection.selection === "BENCH") {
      bench.push({
        id: player.id,
        role: player.role
      });
    }
  }

  const selectedIds = [...starters, ...bench].map((entry) => entry.id);
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("Non puoi usare lo stesso giocatore due volte.");
  }

  if (selectedIds.some((id) => blockedIds.has(id))) {
    throw new Error("Uno o piu giocatori non sono disponibili.");
  }

  if (selectedIds.some((id) => !rosterPlayerMap.get(id)?.isActive)) {
    throw new Error("Uno o piu giocatori non sono disponibili.");
  }

  const validation = validateLineupComposition(
    starters,
    bench.map((entry) => ({ id: entry.id, role: entry.role }))
  );

  if (!validation.isValid) {
    throw new Error(validation.errors[0] ?? "Formazione non valida.");
  }

  const orderedBench = [...bench].sort(
    (left, right) =>
      getBenchPositionOrderByRole(left.role) -
      getBenchPositionOrderByRole(right.role)
  );

  await prisma.$transaction(async (tx) => {
    const lineup = await tx.tournamentLineup.upsert({
      where: {
        fantasyTeamId_tournamentFixtureId: {
          fantasyTeamId: options.fantasyTeamId,
          tournamentFixtureId: options.tournamentFixtureId
        }
      },
      create: {
        fantasyTeamId: options.fantasyTeamId,
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date(),
        tournamentFixtureId: options.tournamentFixtureId
      },
      update: {
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date()
      },
      select: { id: true }
    });

    await tx.tournamentLineupPlayer.deleteMany({
      where: { lineupId: lineup.id }
    });

    await tx.tournamentLineupPlayer.createMany({
      data: [
        ...starters.map((player, index) => ({
          lineupId: lineup.id,
          playerId: player.id,
          positionOrder: index + 1,
          slotType: SlotType.STARTER
        })),
        ...orderedBench.map((player) => ({
          lineupId: lineup.id,
          playerId: player.id,
          positionOrder: getBenchPositionOrderByRole(player.role),
          slotType: SlotType.BENCH
        }))
      ]
    });
  });

  return {
    fixtureId: options.tournamentFixtureId,
    teamId: options.fantasyTeamId,
    tournamentId: tournament.id,
    tournamentName: tournament.name
  };
}
