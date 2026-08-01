import { existsSync } from "node:fs";

import { prisma } from "../lib/prisma.ts";
import { importPlayerList } from "../lib/server/players/import-player-list.ts";
import {
  parseFantacalcioQuotazioniFile,
  resolveDefaultQuotazioniPath
} from "../lib/server/players/parse-fantacalcio-quotazioni.ts";

async function main() {
  const filePath = process.argv[2]?.trim() || resolveDefaultQuotazioniPath();

  if (!existsSync(filePath)) {
    throw new Error(
      `File quotazioni non trovato: ${filePath}. Mettilo in data/quotazioni-fantacalcio-2025-26.xlsx oppure passa il path come argomento.`
    );
  }

  const parsed = parseFantacalcioQuotazioniFile(filePath);
  const players = [...parsed.activePlayers, ...parsed.transferredPlayers];

  if (players.length === 0) {
    throw new Error("Nessun giocatore valido trovato nel file quotazioni.");
  }

  const result = await importPlayerList(players);

  // I demo non devono restare selezionabili insieme alla lista ufficiale.
  const demoDeactivated = await prisma.player.updateMany({
    where: {
      source: "demo",
      isActive: true
    },
    data: {
      isActive: false
    }
  });

  console.log(`File: ${filePath}`);
  console.log(
    `Attivi (foglio Tutti): ${parsed.activePlayers.length}; ceduti (inattivi): ${parsed.transferredPlayers.length}.`
  );
  console.log(
    `Import completato. Totale: ${result.total}, creati: ${result.createdCount}, aggiornati: ${result.updatedCount}.`
  );
  console.log(`Demo disattivati: ${demoDeactivated.count}.`);
}

main()
  .catch((error) => {
    console.error("Errore durante l'import quotazioni Fantacalcio:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
