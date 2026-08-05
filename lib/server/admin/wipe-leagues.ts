import { prisma } from "../../prisma.ts";

import {
  resetLeagueData,
  type ResetLeagueDataSummary
} from "./reset-league-data.ts";

export type WipeLeaguesSummary = ResetLeagueDataSummary;

/**
 * Wipe di tutte le leghe e dati collegati.
 * Rifiuta se esistono ancora tornei: prima WIPE TORNEO.
 */
export async function wipeAllLeagues(): Promise<WipeLeaguesSummary> {
  const tournamentCount = await prisma.tournament.count();
  if (tournamentCount > 0) {
    throw new Error(
      `Prima esegui WIPE TORNEO (${tournamentCount} tornei ancora presenti).`
    );
  }

  return resetLeagueData();
}
