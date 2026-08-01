import { PlayerRole } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import type { ImportedPlayerInput } from "./import-player-list.ts";

export const FANTACALCIO_QUOTAZIONI_SOURCE = "fantacalcio-quotazioni";

const ROLE_BY_CODE: Record<string, PlayerRole> = {
  P: PlayerRole.GOALKEEPER,
  D: PlayerRole.DEFENDER,
  C: PlayerRole.MIDFIELDER,
  A: PlayerRole.ATTACKER
};

export type ParsedFantacalcioQuotazioni = {
  activePlayers: ImportedPlayerInput[];
  transferredPlayers: ImportedPlayerInput[];
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

function parsePlayerRows(
  rows: unknown[][],
  options: { isActive: boolean }
): ImportedPlayerInput[] {
  const headerIndex = rows.findIndex((row) => {
    const first = cellToString(row[0]).toLowerCase();
    return first === "id";
  });

  if (headerIndex < 0) {
    throw new Error("Intestazione 'Id' non trovata nel foglio quotazioni.");
  }

  const players: ImportedPlayerInput[] = [];
  const seenIds = new Set<string>();

  for (const row of rows.slice(headerIndex + 1)) {
    const externalId = cellToString(row[0]);
    const roleCode = cellToString(row[1]);
    const name = cellToString(row[3]);
    const teamName = cellToString(row[4]);

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

    seenIds.add(externalId);
    players.push({
      externalId,
      isActive: options.isActive,
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

export function parseFantacalcioQuotazioniFile(
  absoluteFilePath: string
): ParsedFantacalcioQuotazioni {
  const workbook = XLSX.read(readFileSync(absoluteFilePath), {
    type: "buffer",
    cellDates: false
  });

  const activePlayers = parsePlayerRows(readSheetRows(workbook, "Tutti"), {
    isActive: true
  });

  const transferredPlayers = workbook.SheetNames.includes("Ceduti")
    ? parsePlayerRows(readSheetRows(workbook, "Ceduti"), { isActive: false })
    : [];

  return { activePlayers, transferredPlayers };
}

export function resolveDefaultQuotazioniPath(cwd = process.cwd()) {
  return path.join(cwd, "data", "quotazioni-fantacalcio-2025-26.xlsx");
}
