/**
 * Check freeze rose / import lista giocatori. Pure: nessuna query al DB.
 *
 * roster-alignment costruisce PrismaClient all'import, quindi va caricato
 * dinamicamente DOPO aver messo un DATABASE_URL fittizio (gli import statici
 * sono hoistati e girerebbero prima). L'URL non viene mai usato: non eseguiamo
 * nessuna query.
 */
import assert from "node:assert/strict";

import { MatchdayStatus } from "@prisma/client";

import { isMatchdayInProgress } from "../lib/matchdays/next-useful-matchday.ts";

process.env.DATABASE_URL ??= "postgresql://check:check@127.0.0.1:5432/check";

const { selectLineupPlayerIdsToSwap } = await import(
  "../lib/server/rosters/roster-alignment.ts"
);

function checkMatchdayInProgress() {
  // DRAFT non è iniziata, PUBLISHED/LOCKED sono finite: import consentito.
  assert.equal(isMatchdayInProgress(MatchdayStatus.DRAFT), false);
  assert.equal(isMatchdayInProgress(MatchdayStatus.PUBLISHED), false);
  assert.equal(isMatchdayInProgress(MatchdayStatus.LOCKED), false);

  // Tutto il resto è stagione in movimento: import bloccato.
  assert.equal(isMatchdayInProgress(MatchdayStatus.LINEUPS_OPEN), true);
  assert.equal(isMatchdayInProgress(MatchdayStatus.LINEUPS_LOCKED), true);
  assert.equal(isMatchdayInProgress(MatchdayStatus.VOTES_PENDING), true);
  assert.equal(isMatchdayInProgress(MatchdayStatus.VOTES_COMPLETED), true);
  assert.equal(isMatchdayInProgress(MatchdayStatus.SCORES_CALCULATED), true);
}

function checkLineupSwapSelection() {
  const targets = [
    { id: "lp-1", lineupId: "lineup-a" },
    { id: "lp-2", lineupId: "lineup-b" },
    { id: "lp-3", lineupId: "lineup-c" }
  ];

  // Nessun conflitto: si riassegnano tutte all'entrante.
  assert.deepEqual(selectLineupPlayerIdsToSwap(targets, []), [
    "lp-1",
    "lp-2",
    "lp-3"
  ]);

  // L'entrante è già in lineup-b: quella riga va saltata, altrimenti
  // @@unique([lineupId, playerId]) fa fallire l'update con P2002.
  assert.deepEqual(selectLineupPlayerIdsToSwap(targets, ["lineup-b"]), [
    "lp-1",
    "lp-3"
  ]);

  // Entrante ovunque: nessun update, nessun errore.
  assert.deepEqual(
    selectLineupPlayerIdsToSwap(targets, ["lineup-a", "lineup-b", "lineup-c"]),
    []
  );

  assert.deepEqual(selectLineupPlayerIdsToSwap([], ["lineup-a"]), []);
}

checkMatchdayInProgress();
checkLineupSwapSelection();
console.log("✅ Freeze rose: giornate in corso e swap formazioni ok.");
