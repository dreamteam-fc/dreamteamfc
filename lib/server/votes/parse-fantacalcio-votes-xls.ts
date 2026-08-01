import * as XLSX from "xlsx";

import { FANTACALCIO_QUOTAZIONI_SOURCE } from "../players/parse-fantacalcio-quotazioni.ts";
import type { SavePlayerVoteInput } from "./shared.ts";

export const FANTACALCIO_VOTES_DEFAULT_SHEET = "Fantacalcio";

/**
 * Colonne file Fantacalcio (dopo header Cod.):
 * Gf | Gs | Rp | Rs | Rf | Au | Amm | Esp | Ass
 *
 * Rp = rigori parati → penaltiesSaved (+3)
 * Rs = rigori sbagliati → penaltiesMissed (−3)
 * Rf = rigori realizzati → penaltiesScored (0 pt; gol gia in Gf)
 */
export type ParsedFantacalcioVoteRow = {
  assists: number;
  externalId: string;
  goals: number;
  goalsConceded: number;
  isSv: boolean;
  name: string;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesScored: number;
  redCards: number;
  roleCode: string;
  voteRaw: string;
  yellowCards: number;
};

export type ParsedFantacalcioVotesFile = {
  rows: ParsedFantacalcioVoteRow[];
  sheetName: string;
  source: typeof FANTACALCIO_QUOTAZIONI_SOURCE;
};

function cellToString(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function cellToNonNegativeInt(value: unknown) {
  const raw = cellToString(value);
  if (raw.length === 0) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseVoteCell(value: unknown): { isSv: boolean; voteRaw: string } {
  const voteRaw = cellToString(value);
  if (voteRaw.length === 0) {
    return { isSv: true, voteRaw };
  }

  if (voteRaw.includes("*")) {
    return { isSv: true, voteRaw };
  }

  return { isSv: false, voteRaw };
}

function parseBaseVote(voteRaw: string, isSv: boolean): number | null {
  if (isSv) {
    return null;
  }

  const normalized = voteRaw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function findHeaderRowIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const first = cellToString(row[0]).toLowerCase().replace(/\.$/, "");
    return first === "cod";
  });
}

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(
      `Foglio '${sheetName}' non trovato. Fogli disponibili: ${workbook.SheetNames.join(", ")}.`
    );
  }

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false
  });
}

export function parseFantacalcioVotesWorkbook(
  workbook: XLSX.WorkBook,
  sheetName = FANTACALCIO_VOTES_DEFAULT_SHEET
): ParsedFantacalcioVotesFile {
  const rows = readSheetRows(workbook, sheetName);
  const headerIndex = findHeaderRowIndex(rows);

  if (headerIndex < 0) {
    throw new Error(
      `Intestazione 'Cod.' non trovata nel foglio '${sheetName}'.`
    );
  }

  const parsedRows: ParsedFantacalcioVoteRow[] = [];
  const seenIds = new Set<string>();

  for (const row of rows.slice(headerIndex + 1)) {
    const externalId = cellToString(row[0]);
    if (!/^\d+$/.test(externalId)) {
      continue;
    }

    if (seenIds.has(externalId)) {
      continue;
    }

    const roleCode = cellToString(row[1]);
    const name = cellToString(row[2]);
    const { isSv, voteRaw } = parseVoteCell(row[3]);

    seenIds.add(externalId);
    parsedRows.push({
      assists: cellToNonNegativeInt(row[12]),
      externalId,
      goals: cellToNonNegativeInt(row[4]),
      goalsConceded: cellToNonNegativeInt(row[5]),
      isSv,
      name,
      ownGoals: cellToNonNegativeInt(row[9]),
      penaltiesMissed: cellToNonNegativeInt(row[7]),
      penaltiesSaved: cellToNonNegativeInt(row[6]),
      penaltiesScored: cellToNonNegativeInt(row[8]),
      redCards: cellToNonNegativeInt(row[11]),
      roleCode,
      voteRaw,
      yellowCards: cellToNonNegativeInt(row[10])
    });
  }

  return {
    rows: parsedRows,
    sheetName,
    source: FANTACALCIO_QUOTAZIONI_SOURCE
  };
}

export function parseFantacalcioVotesBuffer(
  buffer: Buffer,
  sheetName = FANTACALCIO_VOTES_DEFAULT_SHEET
): ParsedFantacalcioVotesFile {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false
  });

  return parseFantacalcioVotesWorkbook(workbook, sheetName);
}

export function toSavePlayerVoteInput(
  row: ParsedFantacalcioVoteRow,
  options: { matchdayId: string; playerId: string }
): SavePlayerVoteInput {
  const baseVote = parseBaseVote(row.voteRaw, row.isSv);

  if (!row.isSv && baseVote === null) {
    throw new Error(
      `Voto non valido per Cod.${row.externalId} (${row.name}): '${row.voteRaw}'.`
    );
  }

  return {
    assists: row.assists,
    baseVote,
    goals: row.goals,
    goalsConceded: row.goalsConceded,
    isSv: row.isSv,
    matchdayId: options.matchdayId,
    notes: null,
    ownGoals: row.ownGoals,
    penaltiesMissed: row.penaltiesMissed,
    penaltiesSaved: row.penaltiesSaved,
    penaltiesScored: row.penaltiesScored,
    playerId: options.playerId,
    redCards: row.redCards,
    yellowCards: row.yellowCards
  };
}
