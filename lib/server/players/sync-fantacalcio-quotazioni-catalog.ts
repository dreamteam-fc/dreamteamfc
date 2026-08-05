import { prisma } from "../../prisma.ts";

import type { ImportedPlayerInput } from "./import-player-list.ts";
import {
  FANTACALCIO_QUOTAZIONI_SOURCE,
  parseFantacalcioQuotazioniBuffer,
  type ParsedFantacalcioQuotazioni
} from "./parse-fantacalcio-quotazioni.ts";

export type PlayerCatalogImportMode = "wipe" | "sync";

export type SyncFantacalcioQuotazioniCatalogResult = {
  createdCount: number;
  inDbNotInFileCount: number;
  mode: PlayerCatalogImportMode;
  otherSourceDeactivatedCount: number;
  otherSourceDeletedCount: number;
  parsedCount: number;
  sheetCounts: Record<string, number>;
  unchangedCount: number;
  updatedCount: number;
};

function normalizeNullable(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getCatalogImportMode(): Promise<{
  leagueCount: number;
  mode: PlayerCatalogImportMode;
  tournamentCount: number;
}> {
  const [leagueCount, tournamentCount] = await Promise.all([
    prisma.league.count(),
    prisma.tournament.count()
  ]);

  return {
    leagueCount,
    mode: leagueCount === 0 && tournamentCount === 0 ? "wipe" : "sync",
    tournamentCount
  };
}

export async function getPlayerCatalogImportMode() {
  return getCatalogImportMode();
}

async function countPlayerReferences() {
  const [
    rosterCount,
    lineupPlayerCount,
    requiredVoteCount,
    voteCount,
    teamScorePlayerCount,
    leagueBlockCount,
    tournamentLineupPlayerCount,
    tournamentRequiredVoteCount,
    tournamentVoteCount
  ] = await Promise.all([
    prisma.fantasyRoster.count(),
    prisma.lineupPlayer.count(),
    prisma.requiredVotePlayer.count(),
    prisma.playerVote.count(),
    prisma.teamScorePlayer.count(),
    prisma.leagueBlockedPlayer.count(),
    prisma.tournamentLineupPlayer.count(),
    prisma.tournamentRequiredVotePlayer.count(),
    prisma.tournamentPlayerVote.count()
  ]);

  return {
    leagueBlockCount,
    lineupPlayerCount,
    requiredVoteCount,
    rosterCount,
    teamScorePlayerCount,
    total:
      rosterCount +
      lineupPlayerCount +
      requiredVoteCount +
      voteCount +
      teamScorePlayerCount +
      leagueBlockCount +
      tournamentLineupPlayerCount +
      tournamentRequiredVoteCount +
      tournamentVoteCount,
    tournamentLineupPlayerCount,
    tournamentRequiredVoteCount,
    tournamentVoteCount,
    voteCount
  };
}

async function assertPlayersSafeToWipe() {
  const refs = await countPlayerReferences();
  if (refs.total > 0) {
    throw new Error(
      `Impossibile azzerare il catalogo giocatori: restano riferimenti (rose=${refs.rosterCount}, lineup=${refs.lineupPlayerCount}, voti=${refs.voteCount}, tornei=${refs.tournamentLineupPlayerCount + refs.tournamentRequiredVoteCount + refs.tournamentVoteCount}, altro=${refs.requiredVoteCount + refs.teamScorePlayerCount + refs.leagueBlockCount}). Esegui prima WIPE TORNEO e WIPE LEGHE.`
    );
  }
}

async function wipeAndInsertPlayers(players: ImportedPlayerInput[]) {
  await assertPlayersSafeToWipe();
  await prisma.player.deleteMany();

  for (const player of players) {
    await prisma.player.create({
      data: {
        externalId: player.externalId,
        isActive: true,
        name: player.name.trim(),
        role: player.role,
        source: FANTACALCIO_QUOTAZIONI_SOURCE,
        teamName: normalizeNullable(player.teamName)
      }
    });
  }

  return {
    createdCount: players.length,
    inDbNotInFileCount: 0,
    otherSourceDeactivatedCount: 0,
    otherSourceDeletedCount: 0,
    unchangedCount: 0,
    updatedCount: 0
  };
}

async function deactivateOrDeleteOtherSources() {
  const otherPlayers = await prisma.player.findMany({
    where: {
      OR: [
        { source: null },
        { source: { not: FANTACALCIO_QUOTAZIONI_SOURCE } }
      ]
    },
    select: {
      id: true,
      isActive: true,
      _count: {
        select: {
          leagueBlocks: true,
          lineupPlayers: true,
          requiredVotes: true,
          rosterEntries: true,
          teamScorePlayers: true,
          tournamentLineupPlayers: true,
          tournamentRequiredVotes: true,
          tournamentVotes: true,
          votes: true
        }
      }
    }
  });

  let otherSourceDeletedCount = 0;
  let otherSourceDeactivatedCount = 0;

  for (const player of otherPlayers) {
    const refCount =
      player._count.rosterEntries +
      player._count.lineupPlayers +
      player._count.requiredVotes +
      player._count.votes +
      player._count.teamScorePlayers +
      player._count.leagueBlocks +
      player._count.tournamentLineupPlayers +
      player._count.tournamentRequiredVotes +
      player._count.tournamentVotes;

    if (refCount === 0) {
      await prisma.player.delete({ where: { id: player.id } });
      otherSourceDeletedCount += 1;
      continue;
    }

    if (player.isActive) {
      await prisma.player.update({
        where: { id: player.id },
        data: { isActive: false }
      });
      otherSourceDeactivatedCount += 1;
    }
  }

  return { otherSourceDeactivatedCount, otherSourceDeletedCount };
}

async function syncPlayers(players: ImportedPlayerInput[]) {
  const existing = await prisma.player.findMany({
    where: { source: FANTACALCIO_QUOTAZIONI_SOURCE },
    select: {
      externalId: true,
      id: true,
      isActive: true,
      name: true,
      role: true,
      teamName: true
    }
  });

  const existingByExternalId = new Map(
    existing
      .filter((player) => player.externalId != null)
      .map((player) => [player.externalId as string, player])
  );

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const fileExternalIds = new Set<string>();

  for (const player of players) {
    const externalId = player.externalId.trim();
    const name = player.name.trim();
    const teamName = normalizeNullable(player.teamName);
    fileExternalIds.add(externalId);

    const current = existingByExternalId.get(externalId);
    if (!current) {
      await prisma.player.create({
        data: {
          externalId,
          isActive: true,
          name,
          role: player.role,
          source: FANTACALCIO_QUOTAZIONI_SOURCE,
          teamName
        }
      });
      createdCount += 1;
      continue;
    }

    const changed =
      current.name !== name ||
      current.role !== player.role ||
      normalizeNullable(current.teamName) !== teamName ||
      !current.isActive;

    if (!changed) {
      unchangedCount += 1;
      continue;
    }

    await prisma.player.update({
      where: { id: current.id },
      data: {
        isActive: true,
        name,
        role: player.role,
        teamName
      }
    });
    updatedCount += 1;
  }

  const inDbNotInFileCount = existing.filter(
    (player) =>
      player.externalId != null && !fileExternalIds.has(player.externalId)
  ).length;

  const otherSources = await deactivateOrDeleteOtherSources();

  return {
    createdCount,
    inDbNotInFileCount,
    otherSourceDeactivatedCount: otherSources.otherSourceDeactivatedCount,
    otherSourceDeletedCount: otherSources.otherSourceDeletedCount,
    unchangedCount,
    updatedCount
  };
}

export function formatSyncFantacalcioQuotazioniNotice(
  result: SyncFantacalcioQuotazioniCatalogResult
) {
  if (result.mode === "wipe") {
    return `Wipe lista completato (mode=wipe). Inseriti: ${result.createdCount} da file (${result.parsedCount} parsed).`;
  }

  return `Sync lista completato (mode=sync). Creati: ${result.createdCount}, aggiornati: ${result.updatedCount}, invariati: ${result.unchangedCount}, inDbNotInFile: ${result.inDbNotInFileCount}. Altre sorgenti: disattivati ${result.otherSourceDeactivatedCount}, eliminati ${result.otherSourceDeletedCount}.`;
}

export async function syncFantacalcioQuotazioniCatalogFromBuffer(
  buffer: Buffer
): Promise<SyncFantacalcioQuotazioniCatalogResult> {
  const parsed: ParsedFantacalcioQuotazioni =
    parseFantacalcioQuotazioniBuffer(buffer);
  const { mode } = await getCatalogImportMode();

  const counts =
    mode === "wipe"
      ? await wipeAndInsertPlayers(parsed.players)
      : await syncPlayers(parsed.players);

  return {
    ...counts,
    mode,
    parsedCount: parsed.players.length,
    sheetCounts: parsed.sheetCounts
  };
}
