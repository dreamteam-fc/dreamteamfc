import { prisma } from "../../prisma.ts";

export type WipeTournamentsSummary = {
  tournamentCount: number;
};

/**
 * Cancella tutti i tornei e i dati collegati (cascade Prisma).
 * Non tocca leghe, utenti o catalogo giocatori.
 */
export async function wipeAllTournaments(): Promise<WipeTournamentsSummary> {
  const tournamentCount = await prisma.tournament.count();
  await prisma.tournament.deleteMany();

  return { tournamentCount };
}
