import { PlayerRole } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import type { ImportedPlayerInput } from "./import-player-list.ts";

export const FANTACALCIO_QUOTAZIONI_SOURCE = "fantacalcio-quotazioni";

const ROLE_SHEETS = [
  { sheetName: "Portieri", role: PlayerRole.GOALKEEPER, roleCode: "P" },
  { sheetName: "Difensori", role: PlayerRole.DEFENDER, roleCode: "D" },
  { sheetName: "Centrocampisti", role: PlayerRole.MIDFIELDER, roleCode: "C" },
  { sheetName: "Attaccanti", role: PlayerRole.ATTACKER, roleCode: "A" }
] as const;

const ROLE_BY_CODE: Record<string, PlayerRole> = {
  P: PlayerRole.GOALKEEPER,
  D: PlayerRole.DEFENDER,
  C: PlayerRole.MIDFIELDER,
  A: PlayerRole.ATTACKER
};

export type ParsedFantacalcioQuotazioni = {
  players: ImportedPlayerInput[];
  sheetCounts: Record<string, number>;
};

function cellToString(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function mapRole(code: string): PlayerRole | null {
  return ROLE_BY_CODE[code.toUpperCase()] ?? null;
}

function findHeaderIndex(rows: unknown[][]) {
  return rows.findIndex((row) => cellToString(row[0]).toLowerCase() === "id");
}

function resolveColumnIndexes(headerRow: unknown[]) {
  const normalized = headerRow.map((cell) => cellToString(cell).toLowerCase());
  const idIndex = normalized.indexOf("id");
  const roleIndex = normalized.indexOf("r");
  const nameIndex = normalized.indexOf("nome");
  const teamIndex = normalized.indexOf("squadra");

  if (idIndex < 0 || roleIndex < 0 || nameIndex < 0 || teamIndex < 0) {
    throw new Error(
      "Intestazione non valida: richieste le colonne Id, R, Nome, Squadra."
    );
  }

  return { idIndex, nameIndex, roleIndex, teamIndex };
}

function parseRoleSheetRows(
  rows: unknown[][],
  options: { expectedRole: PlayerRole; sheetName: string }
): ImportedPlayerInput[] {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error(
      `Intestazione 'Id' non trovata nel foglio '${options.sheetName}'.`
    );
  }

  let columns: ReturnType<typeof resolveColumnIndexes>;
  try {
    columns = resolveColumnIndexes(rows[headerIndex] ?? []);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Intestazione non valida.";
    throw new Error(`Foglio '${options.sheetName}': ${message}`);
  }

  const players: ImportedPlayerInput[] = [];
  const seenIds = new Set<string>();

  for (const row of rows.slice(headerIndex + 1)) {
    const externalId = cellToString(row[columns.idIndex]);
    const roleCode = cellToString(row[columns.roleIndex]);
    const name = cellToString(row[columns.nameIndex]);
    const teamName = cellToString(row[columns.teamIndex]);

    if (!externalId || !name) {
      continue;
    }

    if (seenIds.has(externalId)) {
      continue;
    }

    const role = mapRole(roleCode);
    if (!role) {
      continue;
    }

    if (role !== options.expectedRole) {
      throw new Error(
        `Foglio '${options.sheetName}': ruolo incoerente per Cod ${externalId} (atteso ${options.expectedRole}, trovato ${role}).`
      );
    }

    seenIds.add(externalId);
    players.push({
      externalId,
      isActive: true,
      name,
      role,
      source: FANTACALCIO_QUOTAZIONI_SOURCE,
      teamName: teamName.length > 0 ? teamName : null
    });
  }

  return players;
}

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Foglio '${sheetName}' non trovato nel file quotazioni.`);
  }

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false
  });
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedFantacalcioQuotazioni {
  const missingSheets = ROLE_SHEETS.map((sheet) => sheet.sheetName).filter(
    (sheetName) => !workbook.SheetNames.includes(sheetName)
  );

  if (missingSheets.length > 0) {
    throw new Error(
      `Fogli mancanti nel file quotazioni: ${missingSheets.join(", ")}. Richiesti: ${ROLE_SHEETS.map((sheet) => sheet.sheetName).join(", ")}.`
    );
  }

  const players: ImportedPlayerInput[] = [];
  const sheetCounts: Record<string, number> = {};
  const seenIds = new Set<string>();

  for (const sheet of ROLE_SHEETS) {
    const sheetPlayers = parseRoleSheetRows(
      readSheetRows(workbook, sheet.sheetName),
      {
        expectedRole: sheet.role,
        sheetName: sheet.sheetName
      }
    );

    for (const player of sheetPlayers) {
      if (seenIds.has(player.externalId)) {
        throw new Error(
          `Cod ${player.externalId} duplicato tra i fogli ruolo (${sheet.sheetName}).`
        );
      }
      seenIds.add(player.externalId);
      players.push(player);
    }

    sheetCounts[sheet.sheetName] = sheetPlayers.length;
  }

  if (players.length === 0) {
    throw new Error("Nessun giocatore valido trovato nei fogli ruolo.");
  }

  return { players, sheetCounts };
}

export function parseFantacalcioQuotazioniBuffer(
  buffer: Buffer
): ParsedFantacalcioQuotazioni {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false
  });

  return parseWorkbook(workbook);
}

export function parseFantacalcioQuotazioniFile(
  absoluteFilePath: string
): ParsedFantacalcioQuotazioni {
  return parseFantacalcioQuotazioniBuffer(readFileSync(absoluteFilePath));
}

export function resolveDefaultQuotazioniPath(cwd = process.cwd()) {
  return path.join(cwd, "data", "quotazioni-fantacalcio-2025-26.xlsx");
}
