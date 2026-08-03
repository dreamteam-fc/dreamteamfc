import { randomUUID } from "node:crypto";

import {
  Prisma,
  RequiredVoteStatus,
  VoteStatus,
  type PlayerRole
} from "@prisma/client";

import { FANTACALCIO_QUOTAZIONI_SOURCE } from "../players/parse-fantacalcio-quotazioni.ts";
import { prisma } from "../../prisma.ts";
import { generateRequiredVotePlayers } from "../matchdays/generate-required-vote-players.ts";
import { checkVotesCompletion } from "../matchdays/check-votes-completion.ts";
import {
  parseFantacalcioVotesBuffer,
  toSavePlayerVoteInput,
  type ParsedFantacalcioVoteRow,
  type ParsedFantacalcioVotesFile
} from "./parse-fantacalcio-votes-xls.ts";
import {
  calculatePersistedFantavote,
  validatePlayerVoteInput,
  type SavePlayerVoteInput
} from "./shared.ts";

export type ImportFantacalcioVotesResult = {
  matchedCount: number;
  missingMarkedSvCount: number;
  savedCount: number;
  sheetName: string;
  skippedUnmatchedCodes: string[];
  totalRowsInFile: number;
};

export type ImportFantacalcioVotesAcrossMatchdaysResult = {
  failed: Array<{
    error: string;
    leagueId: string;
    leagueName: string;
    matchdayId: string;
  }>;
  sheetName: string;
  skippedUnmatchedCodes: string[];
  succeeded: Array<{
    leagueId: string;
    leagueName: string;
    matchdayId: string;
    matchedCount: number;
    missingMarkedSvCount: number;
    savedCount: number;
  }>;
  totalRowsInFile: number;
};

type PlayerVoteWriteRow = {
  assists: number;
  baseVote: Prisma.Decimal | null;
  cleanSheet: number;
  finalFantavote: Prisma.Decimal | null;
  goals: number;
  goalsConceded: number;
  id: string;
  isSv: boolean;
  matchdayId: string;
  notes: string | null;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesScored: number;
  playerId: string;
  redCards: number;
  requiredVoteStatus: RequiredVoteStatus;
  status: typeof VoteStatus.CONFIRMED;
  yellowCards: number;
};

type PrecomputedVoteByPlayerId = Map<
  string,
  Omit<SavePlayerVoteInput, "matchdayId">
>;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function loadRequiredPlayers(matchdayId: string) {
  return prisma.requiredVotePlayer.findMany({
    where: {
      matchdayId,
      status: { not: RequiredVoteStatus.IGNORED }
    },
    select: {
      playerId: true,
      player: {
        select: {
          id: true,
          externalId: true,
          name: true,
          role: true,
          source: true
        }
      }
    }
  });
}

function buildVoteWriteRow(
  input: SavePlayerVoteInput,
  role: PlayerRole
): PlayerVoteWriteRow {
  const validatedInput = validatePlayerVoteInput(input);
  const isGoalkeeper = role === "GOALKEEPER";
  const goalsConceded = isGoalkeeper ? validatedInput.goalsConceded : 0;
  const cleanSheet =
    !validatedInput.isSv && isGoalkeeper && goalsConceded === 0 ? 1 : 0;

  const voteForPersist = {
    ...validatedInput,
    cleanSheet,
    goalsConceded
  };
  const { finalFantavote, requiredVoteStatus } =
    calculatePersistedFantavote(voteForPersist);

  return {
    assists: voteForPersist.assists,
    baseVote:
      voteForPersist.baseVote === null
        ? null
        : new Prisma.Decimal(voteForPersist.baseVote),
    cleanSheet: voteForPersist.cleanSheet,
    finalFantavote,
    goals: voteForPersist.goals,
    goalsConceded: voteForPersist.goalsConceded,
    id: randomUUID(),
    isSv: voteForPersist.isSv,
    matchdayId: voteForPersist.matchdayId,
    notes: voteForPersist.notes,
    ownGoals: voteForPersist.ownGoals,
    penaltiesMissed: voteForPersist.penaltiesMissed,
    penaltiesSaved: voteForPersist.penaltiesSaved,
    penaltiesScored: voteForPersist.penaltiesScored,
    playerId: voteForPersist.playerId,
    redCards: voteForPersist.redCards,
    requiredVoteStatus,
    status: VoteStatus.CONFIRMED,
    yellowCards: voteForPersist.yellowCards
  };
}

async function persistPlayerVoteRows(
  matchdayId: string,
  rows: PlayerVoteWriteRow[]
) {
  if (rows.length === 0) {
    return;
  }

  const playerIds = rows.map((row) => row.playerId);

  // Prefer delete + createMany over N interactive upsert txs (PgBouncer /
  // Railway proxy). TeamScorePlayer.playerVoteId is onDelete: SetNull.
  await prisma.playerVote.deleteMany({
    where: {
      matchdayId,
      playerId: { in: playerIds }
    }
  });

  await createPlayerVotesInChunks(
    rows.map(({ requiredVoteStatus: _status, ...voteRow }) => voteRow)
  );

  await updateRequiredVoteStatusesByGroup(
    matchdayId,
    rows.map((row) => ({
      playerId: row.playerId,
      status: row.requiredVoteStatus
    }))
  );
}

async function createPlayerVotesInChunks(
  rows: Array<Omit<PlayerVoteWriteRow, "requiredVoteStatus">>,
  chunkSize = 100
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await prisma.playerVote.createMany({
      data: chunk
    });
  }
}

async function updateRequiredVoteStatusesByGroup(
  matchdayId: string,
  rows: Array<{ playerId: string; status: RequiredVoteStatus }>,
  chunkSize = 100
) {
  const groups = new Map<RequiredVoteStatus, string[]>();

  for (const row of rows) {
    const group = groups.get(row.status);
    if (group) {
      group.push(row.playerId);
    } else {
      groups.set(row.status, [row.playerId]);
    }
  }

  for (const [status, playerIds] of groups) {
    for (let index = 0; index < playerIds.length; index += chunkSize) {
      const chunk = playerIds.slice(index, index + chunkSize);
      await prisma.requiredVotePlayer.updateMany({
        where: {
          matchdayId,
          playerId: { in: chunk }
        },
        data: { status }
      });
    }
  }
}

function resolvePlayerIdByExternalId(
  matchedPlayers: Array<{ id: string; externalId: string | null }>
) {
  return new Map(
    matchedPlayers
      .filter((player) => player.externalId)
      .map((player) => [player.externalId as string, player.id])
  );
}

function precomputeVotesByPlayerId(
  parsed: ParsedFantacalcioVotesFile,
  playerIdByExternalId: Map<string, string>
): {
  skippedUnmatchedCodes: string[];
  votesByPlayerId: PrecomputedVoteByPlayerId;
} {
  const votesByPlayerId: PrecomputedVoteByPlayerId = new Map();
  const skippedUnmatchedCodes: string[] = [];

  for (const row of parsed.rows) {
    const playerId = playerIdByExternalId.get(row.externalId);
    if (!playerId) {
      skippedUnmatchedCodes.push(row.externalId);
      continue;
    }

    try {
      // Validate once for the whole multi-league run. Placeholder matchdayId is
      // replaced per league when building write rows.
      const input = toSavePlayerVoteInput(row, {
        matchdayId: "__template__",
        playerId
      });
      const { matchdayId: _matchdayId, ...voteWithoutMatchday } = input;
      votesByPlayerId.set(playerId, voteWithoutMatchday);
    } catch {
      // Skip invalid rows instead of aborting every league.
      skippedUnmatchedCodes.push(row.externalId);
    }
  }

  return { skippedUnmatchedCodes, votesByPlayerId };
}

function buildWriteRowsForMatchday(options: {
  matchdayId: string;
  requiredPlayers: Awaited<ReturnType<typeof loadRequiredPlayers>>;
  rowsByExternalId: Map<string, ParsedFantacalcioVoteRow>;
  votesByPlayerId: PrecomputedVoteByPlayerId;
}): {
  matchedCount: number;
  missingMarkedSvCount: number;
  writeRows: PlayerVoteWriteRow[];
} {
  const requiredByPlayerId = new Map(
    options.requiredPlayers.map((entry) => [entry.playerId, entry])
  );
  const writeRows: PlayerVoteWriteRow[] = [];
  let matchedCount = 0;

  for (const [playerId, vote] of options.votesByPlayerId) {
    const required = requiredByPlayerId.get(playerId);
    if (!required) {
      continue;
    }

    matchedCount += 1;
    writeRows.push(
      buildVoteWriteRow(
        {
          ...vote,
          matchdayId: options.matchdayId
        },
        required.player.role
      )
    );
  }

  let missingMarkedSvCount = 0;
  for (const required of options.requiredPlayers) {
    const externalId = required.player.externalId;
    const isFantacalcioPlayer =
      required.player.source === FANTACALCIO_QUOTAZIONI_SOURCE;

    const presentInFile =
      isFantacalcioPlayer &&
      externalId != null &&
      options.rowsByExternalId.has(externalId);

    if (presentInFile) {
      continue;
    }

    writeRows.push(
      buildVoteWriteRow(
        {
          baseVote: null,
          isSv: true,
          matchdayId: options.matchdayId,
          notes: "SV automatico: assente dal file voti",
          playerId: required.playerId
        },
        required.player.role
      )
    );
    missingMarkedSvCount += 1;
  }

  return { matchedCount, missingMarkedSvCount, writeRows };
}

/**
 * Ensure a usable required-vote list exists for the matchday.
 * Generates from lineups only when the list is missing/empty.
 */
export async function ensureRequiredVotePlayersForMatchday(
  matchdayId: string
): Promise<void> {
  const existingCount = await prisma.requiredVotePlayer.count({
    where: {
      matchdayId,
      status: { not: RequiredVoteStatus.IGNORED }
    }
  });

  if (existingCount > 0) {
    return;
  }

  const generated = await generateRequiredVotePlayers(matchdayId);
  if (generated.totalRequired === 0) {
    throw new Error(
      "Nessun giocatore in formazione: impossibile generare la lista voti."
    );
  }
}

async function importParsedFantacalcioVotesForMatchday(options: {
  matchdayId: string;
  parsed: ParsedFantacalcioVotesFile;
  playerIdByExternalId: Map<string, string>;
  votesByPlayerId?: PrecomputedVoteByPlayerId;
}): Promise<ImportFantacalcioVotesResult> {
  const requiredPlayers = await loadRequiredPlayers(options.matchdayId);
  if (requiredPlayers.length === 0) {
    throw new Error(
      "Nessun giocatore in lista voti richiesti. Genera prima la lista voti."
    );
  }

  const precomputed =
    options.votesByPlayerId != null
      ? {
          skippedUnmatchedCodes: [] as string[],
          votesByPlayerId: options.votesByPlayerId
        }
      : precomputeVotesByPlayerId(
          options.parsed,
          options.playerIdByExternalId
        );

  const rowsByExternalId = new Map<string, ParsedFantacalcioVoteRow>();
  for (const row of options.parsed.rows) {
    rowsByExternalId.set(row.externalId, row);
  }

  const { matchedCount, missingMarkedSvCount, writeRows } =
    buildWriteRowsForMatchday({
      matchdayId: options.matchdayId,
      requiredPlayers,
      rowsByExternalId,
      votesByPlayerId: precomputed.votesByPlayerId
    });

  const skippedUnmatchedCodes = precomputed.skippedUnmatchedCodes;

  await persistPlayerVoteRows(options.matchdayId, writeRows);
  await checkVotesCompletion(options.matchdayId);

  return {
    matchedCount,
    missingMarkedSvCount,
    savedCount: writeRows.length,
    sheetName: options.parsed.sheetName,
    skippedUnmatchedCodes,
    totalRowsInFile: options.parsed.rows.length
  };
}

/**
 * Import Fantacalcio XLS votes for one matchday.
 *
 * Avoids N interactive `$transaction` upserts (one per player): precompute in
 * memory, then deleteMany + createMany / updateMany in chunks — same durable
 * pattern as required-vote generation and calendar writes.
 */
export async function importFantacalcioVotesFromBuffer(options: {
  buffer: Buffer;
  matchdayId: string;
  sheetName?: string;
}): Promise<ImportFantacalcioVotesResult> {
  const parsed = parseFantacalcioVotesBuffer(
    options.buffer,
    options.sheetName
  );

  if (parsed.rows.length === 0) {
    throw new Error("Nessuna riga voto valida trovata nel file.");
  }

  const matchedPlayers = await prisma.player.findMany({
    where: {
      source: FANTACALCIO_QUOTAZIONI_SOURCE,
      externalId: { in: parsed.rows.map((row) => row.externalId) }
    },
    select: {
      id: true,
      externalId: true
    }
  });

  return importParsedFantacalcioVotesForMatchday({
    matchdayId: options.matchdayId,
    parsed,
    playerIdByExternalId: resolvePlayerIdByExternalId(matchedPlayers)
  });
}

/**
 * Propagate one Fantacalcio file across many matchdays (pagelle unificate).
 *
 * Phases (Railway-safe):
 * 1. Ensure required-vote lists for every league (generate only if missing)
 * 2. Parse XLS + resolve codes once; precompute validated votes once
 * 3. Import leagues with bounded concurrency (isolated errors)
 */
export async function importFantacalcioVotesAcrossMatchdays(options: {
  buffer: Buffer;
  matchdays: Array<{
    id: string;
    leagueId: string;
    leagueName: string;
  }>;
  /**
   * @deprecated Prefer built-in ensureRequiredLists. Kept for callers that
   * need a custom prepare hook; runs for every matchday before import.
   */
  prepareMatchday?: (matchdayId: string) => Promise<void>;
  /** Default true: auto-generate missing required-vote lists before import. */
  ensureRequiredLists?: boolean;
  sheetName?: string;
  /** Concurrent league imports. Default 3 — balances speed vs DB pool. */
  concurrency?: number;
}): Promise<ImportFantacalcioVotesAcrossMatchdaysResult> {
  const ensureRequiredLists = options.ensureRequiredLists !== false;
  const concurrency = options.concurrency ?? 3;

  const parsed = parseFantacalcioVotesBuffer(
    options.buffer,
    options.sheetName
  );

  if (parsed.rows.length === 0) {
    throw new Error("Nessuna riga voto valida trovata nel file.");
  }

  const matchedPlayers = await prisma.player.findMany({
    where: {
      source: FANTACALCIO_QUOTAZIONI_SOURCE,
      externalId: { in: parsed.rows.map((row) => row.externalId) }
    },
    select: {
      id: true,
      externalId: true
    }
  });
  const playerIdByExternalId = resolvePlayerIdByExternalId(matchedPlayers);
  const { skippedUnmatchedCodes, votesByPlayerId } = precomputeVotesByPlayerId(
    parsed,
    playerIdByExternalId
  );

  const rowsByExternalId = new Map<string, ParsedFantacalcioVoteRow>();
  for (const row of parsed.rows) {
    rowsByExternalId.set(row.externalId, row);
  }

  const result: ImportFantacalcioVotesAcrossMatchdaysResult = {
    failed: [],
    sheetName: parsed.sheetName,
    skippedUnmatchedCodes,
    succeeded: [],
    totalRowsInFile: parsed.rows.length
  };

  // Phase 1: make sure every league has a required-vote list before any import.
  // Doing this up-front avoids "only leagues that already had lists get votes".
  const prepared = await mapPool(
    options.matchdays,
    concurrency,
    async (matchday) => {
      try {
        if (options.prepareMatchday) {
          await options.prepareMatchday(matchday.id);
        } else if (ensureRequiredLists) {
          await ensureRequiredVotePlayersForMatchday(matchday.id);
        }
        return { matchday, error: null as string | null };
      } catch (error) {
        return {
          matchday,
          error:
            error instanceof Error
              ? error.message
              : "Preparazione lista voti non riuscita."
        };
      }
    }
  );

  const readyMatchdays = [];
  for (const item of prepared) {
    if (item.error) {
      result.failed.push({
        error: item.error,
        leagueId: item.matchday.leagueId,
        leagueName: item.matchday.leagueName,
        matchdayId: item.matchday.id
      });
    } else {
      readyMatchdays.push(item.matchday);
    }
  }

  if (readyMatchdays.length === 0) {
    return result;
  }

  // Phase 2: one query for all required players across ready leagues.
  const allRequired = await prisma.requiredVotePlayer.findMany({
    where: {
      matchdayId: { in: readyMatchdays.map((matchday) => matchday.id) },
      status: { not: RequiredVoteStatus.IGNORED }
    },
    select: {
      matchdayId: true,
      playerId: true,
      player: {
        select: {
          id: true,
          externalId: true,
          name: true,
          role: true,
          source: true
        }
      }
    }
  });

  const requiredByMatchdayId = new Map<
    string,
    Awaited<ReturnType<typeof loadRequiredPlayers>>
  >();
  for (const matchday of readyMatchdays) {
    requiredByMatchdayId.set(matchday.id, []);
  }
  for (const row of allRequired) {
    const bucket = requiredByMatchdayId.get(row.matchdayId);
    if (bucket) {
      bucket.push(row);
    }
  }

  // Phase 3: persist votes per league with bounded concurrency.
  const importOutcomes = await mapPool(
    readyMatchdays,
    concurrency,
    async (matchday) => {
      try {
        const requiredPlayers = requiredByMatchdayId.get(matchday.id) ?? [];
        if (requiredPlayers.length === 0) {
          throw new Error(
            "Nessun giocatore in lista voti richiesti. Genera prima la lista voti."
          );
        }

        const { matchedCount, missingMarkedSvCount, writeRows } =
          buildWriteRowsForMatchday({
            matchdayId: matchday.id,
            requiredPlayers,
            rowsByExternalId,
            votesByPlayerId
          });

        await persistPlayerVoteRows(matchday.id, writeRows);
        await checkVotesCompletion(matchday.id);

        return {
          matchday,
          error: null as string | null,
          matchedCount,
          missingMarkedSvCount,
          savedCount: writeRows.length
        };
      } catch (error) {
        return {
          matchday,
          error:
            error instanceof Error
              ? error.message
              : "Import voti non riuscito.",
          matchedCount: 0,
          missingMarkedSvCount: 0,
          savedCount: 0
        };
      }
    }
  );

  for (const outcome of importOutcomes) {
    if (outcome.error) {
      result.failed.push({
        error: outcome.error,
        leagueId: outcome.matchday.leagueId,
        leagueName: outcome.matchday.leagueName,
        matchdayId: outcome.matchday.id
      });
      continue;
    }

    result.succeeded.push({
      leagueId: outcome.matchday.leagueId,
      leagueName: outcome.matchday.leagueName,
      matchdayId: outcome.matchday.id,
      matchedCount: outcome.matchedCount,
      missingMarkedSvCount: outcome.missingMarkedSvCount,
      savedCount: outcome.savedCount
    });
  }

  return result;
}

export function formatImportFantacalcioVotesAcrossMatchdaysNotice(
  summary: ImportFantacalcioVotesAcrossMatchdaysResult,
  matchdayNumber: number
): string {
  const ok = summary.succeeded.length;
  const failed = summary.failed.length;
  const savedCount = summary.succeeded.reduce(
    (total, item) => total + item.savedCount,
    0
  );

  const parts = [
    `Import multi-lega giornata ${matchdayNumber} (${summary.sheetName}): ${ok} leghe ok`,
    `${failed} errori`,
    `${savedCount} voti salvati`
  ];

  const details: string[] = [];

  if (ok > 0) {
    // List every league so admins can see full propagation at a glance.
    const okList = summary.succeeded
      .map((item) => `${item.leagueName} (${item.savedCount})`)
      .join(", ");
    details.push(`ok: ${okList}`);
  }

  if (failed > 0) {
    const failList = summary.failed
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    details.push(`errori: ${failList}`);
  }

  if (summary.skippedUnmatchedCodes.length > 0) {
    const codes = summary.skippedUnmatchedCodes.slice(0, 8).join(", ");
    details.push(
      `Codici non in DB: ${codes}${summary.skippedUnmatchedCodes.length > 8 ? "…" : ""}`
    );
  }

  const message =
    details.length === 0
      ? `${parts.join(", ")}.`
      : `${parts.join(", ")}. ${details.join(" · ")}`;

  // Query-string flash notices must stay short for browsers/proxies.
  const MAX_NOTICE_CHARS = 1800;
  if (message.length <= MAX_NOTICE_CHARS) {
    return message;
  }

  return `${message.slice(0, MAX_NOTICE_CHARS - 1)}…`;
}
