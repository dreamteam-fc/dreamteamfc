import { FANTACALCIO_QUOTAZIONI_SOURCE } from "../players/parse-fantacalcio-quotazioni.ts";
import { prisma } from "../../prisma.ts";
import { checkVotesCompletion } from "../matchdays/check-votes-completion.ts";
import {
  parseFantacalcioVotesBuffer,
  toSavePlayerVoteInput,
  type ParsedFantacalcioVoteRow
} from "./parse-fantacalcio-votes-xls.ts";
import { savePlayerVote } from "./save-player-vote.ts";

export type ImportFantacalcioVotesResult = {
  matchedCount: number;
  missingMarkedSvCount: number;
  savedCount: number;
  sheetName: string;
  skippedUnmatchedCodes: string[];
  totalRowsInFile: number;
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
          source: true
        }
      }
    }
  });
}

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

  const requiredPlayers = await loadRequiredPlayers(options.matchdayId);
  if (requiredPlayers.length === 0) {
    throw new Error(
      "Nessun giocatore in lista voti richiesti. Genera prima la lista voti."
    );
  }

  const externalIds = parsed.rows.map((row) => row.externalId);
  const matchedPlayers = await prisma.player.findMany({
    where: {
      source: FANTACALCIO_QUOTAZIONI_SOURCE,
      externalId: { in: externalIds }
    },
    select: {
      id: true,
      externalId: true
    }
  });

  const playerIdByExternalId = new Map(
    matchedPlayers
      .filter((player) => player.externalId)
      .map((player) => [player.externalId as string, player.id])
  );

  const requiredByPlayerId = new Map(
    requiredPlayers.map((entry) => [entry.playerId, entry])
  );

  const rowsByExternalId = new Map<string, ParsedFantacalcioVoteRow>();
  for (const row of parsed.rows) {
    rowsByExternalId.set(row.externalId, row);
  }

  const skippedUnmatchedCodes: string[] = [];
  let matchedCount = 0;
  let savedCount = 0;

  for (const row of parsed.rows) {
    const playerId = playerIdByExternalId.get(row.externalId);
    if (!playerId) {
      skippedUnmatchedCodes.push(row.externalId);
      continue;
    }

    if (!requiredByPlayerId.has(playerId)) {
      // Solo i giocatori in lista voti richiesti vengono aggiornati dal file.
      continue;
    }

    matchedCount += 1;
    await savePlayerVote(
      toSavePlayerVoteInput(row, {
        matchdayId: options.matchdayId,
        playerId
      })
    );
    savedCount += 1;
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

    await savePlayerVote({
      baseVote: null,
      isSv: true,
      matchdayId: options.matchdayId,
      notes: "SV automatico: assente dal file voti",
      playerId: required.playerId
    });
    missingMarkedSvCount += 1;
    savedCount += 1;
  }

  await checkVotesCompletion(options.matchdayId);

  return {
    matchedCount,
    missingMarkedSvCount,
    savedCount,
    sheetName: parsed.sheetName,
    skippedUnmatchedCodes,
    totalRowsInFile: parsed.rows.length
  };
}
