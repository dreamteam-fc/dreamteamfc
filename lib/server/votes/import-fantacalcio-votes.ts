import { randomUUID } from "node:crypto";

import {
  Prisma,
  RequiredVoteStatus,
  VoteStatus,
  type PlayerRole
} from "@prisma/client";

import { FANTACALCIO_QUOTAZIONI_SOURCE } from "../players/parse-fantacalcio-quotazioni.ts";
import { prisma } from "../../prisma.ts";
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

async function loadRequiredPlayers(matchdayId: string) {
  return prisma.requiredVotePlayer.findMany({
    where: { matchdayId },
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

async function importParsedFantacalcioVotesForMatchday(options: {
  matchdayId: string;
  parsed: ParsedFantacalcioVotesFile;
  playerIdByExternalId: Map<string, string>;
}): Promise<ImportFantacalcioVotesResult> {
  const requiredPlayers = await loadRequiredPlayers(options.matchdayId);
  if (requiredPlayers.length === 0) {
    throw new Error(
      "Nessun giocatore in lista voti richiesti. Genera prima la lista voti."
    );
  }

  const requiredByPlayerId = new Map(
    requiredPlayers.map((entry) => [entry.playerId, entry])
  );
  const rowsByExternalId = new Map<string, ParsedFantacalcioVoteRow>();
  for (const row of options.parsed.rows) {
    rowsByExternalId.set(row.externalId, row);
  }

  const skippedUnmatchedCodes: string[] = [];
  const writeRows: PlayerVoteWriteRow[] = [];
  let matchedCount = 0;

  for (const row of options.parsed.rows) {
    const playerId = options.playerIdByExternalId.get(row.externalId);
    if (!playerId) {
      skippedUnmatchedCodes.push(row.externalId);
      continue;
    }

    const required = requiredByPlayerId.get(playerId);
    if (!required) {
      // Solo i giocatori in lista voti richiesti vengono aggiornati dal file.
      continue;
    }

    matchedCount += 1;
    writeRows.push(
      buildVoteWriteRow(
        toSavePlayerVoteInput(row, {
          matchdayId: options.matchdayId,
          playerId
        }),
        required.player.role
      )
    );
  }

  let missingMarkedSvCount = 0;
  for (const required of requiredPlayers) {
    const externalId = required.player.externalId;
    const isFantacalcioPlayer =
      required.player.source === FANTACALCIO_QUOTAZIONI_SOURCE;

    const presentInFile =
      isFantacalcioPlayer &&
      externalId != null &&
      rowsByExternalId.has(externalId);

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
 * Parses the XLS once, resolves player codes once, then imports per matchday
 * with isolated errors so one failing league does not abort the others.
 */
export async function importFantacalcioVotesAcrossMatchdays(options: {
  buffer: Buffer;
  matchdays: Array<{
    id: string;
    leagueId: string;
    leagueName: string;
  }>;
  prepareMatchday?: (matchdayId: string) => Promise<void>;
  sheetName?: string;
}): Promise<ImportFantacalcioVotesAcrossMatchdaysResult> {
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

  const result: ImportFantacalcioVotesAcrossMatchdaysResult = {
    failed: [],
    sheetName: parsed.sheetName,
    skippedUnmatchedCodes: [],
    succeeded: [],
    totalRowsInFile: parsed.rows.length
  };
  const unmatched = new Set<string>();

  for (const matchday of options.matchdays) {
    try {
      if (options.prepareMatchday) {
        await options.prepareMatchday(matchday.id);
      }

      const importResult = await importParsedFantacalcioVotesForMatchday({
        matchdayId: matchday.id,
        parsed,
        playerIdByExternalId
      });

      for (const code of importResult.skippedUnmatchedCodes) {
        unmatched.add(code);
      }

      result.succeeded.push({
        leagueId: matchday.leagueId,
        leagueName: matchday.leagueName,
        matchdayId: matchday.id,
        matchedCount: importResult.matchedCount,
        missingMarkedSvCount: importResult.missingMarkedSvCount,
        savedCount: importResult.savedCount
      });
    } catch (error) {
      result.failed.push({
        error:
          error instanceof Error
            ? error.message
            : "Import voti non riuscito.",
        leagueId: matchday.leagueId,
        leagueName: matchday.leagueName,
        matchdayId: matchday.id
      });
    }
  }

  result.skippedUnmatchedCodes = Array.from(unmatched);
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
    const preview = summary.succeeded
      .slice(0, 4)
      .map((item) => item.leagueName)
      .join(", ");
    details.push(`ok: ${preview}${ok > 4 ? "…" : ""}`);
  }

  if (failed > 0) {
    const preview = summary.failed
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    details.push(`${preview}${failed > 3 ? "…" : ""}`);
  }

  if (summary.skippedUnmatchedCodes.length > 0) {
    const codes = summary.skippedUnmatchedCodes.slice(0, 8).join(", ");
    details.push(
      `Codici non in DB: ${codes}${summary.skippedUnmatchedCodes.length > 8 ? "…" : ""}`
    );
  }

  if (details.length === 0) {
    return `${parts.join(", ")}.`;
  }

  return `${parts.join(", ")}. ${details.join(" · ")}`;
}
