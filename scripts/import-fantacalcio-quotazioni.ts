import { existsSync, readFileSync } from "node:fs";

import { prisma } from "../lib/prisma.ts";
import {
  formatSyncFantacalcioQuotazioniNotice,
  syncFantacalcioQuotazioniCatalogFromBuffer
} from "../lib/server/players/sync-fantacalcio-quotazioni-catalog.ts";
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

  // Validate parse early for clearer CLI errors before DB writes.
  const parsed = parseFantacalcioQuotazioniFile(filePath);
  const result = await syncFantacalcioQuotazioniCatalogFromBuffer(
    readFileSync(filePath)
  );

  console.log(`File: ${filePath}`);
  console.log(
    `Fogli: ${Object.entries(parsed.sheetCounts)
      .map(([name, count]) => `${name}=${count}`)
      .join(", ")}`
  );
  console.log(formatSyncFantacalcioQuotazioniNotice(result));
}

main()
  .catch((error) => {
    console.error("Errore durante l'import quotazioni Fantacalcio:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
