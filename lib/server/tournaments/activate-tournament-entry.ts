import { TournamentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { verifySecret } from "@/lib/server/security/secret-hash.ts";

export async function activateTournamentEntry(options: {
  appUserId: string;
  fantasyTeamId: string;
  password: string;
  tournamentId: string;
}) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: options.tournamentId },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      status: true,
      entries: {
        where: { fantasyTeamId: options.fantasyTeamId },
        select: {
          id: true,
          activatedAt: true,
          fantasyTeam: {
            select: {
              id: true,
              name: true,
              userId: true
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    throw new Error("Torneo non trovato.");
  }

  if (
    tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    tournament.status !== TournamentStatus.IN_PROGRESS &&
    tournament.status !== TournamentStatus.ENTRIES_SET
  ) {
    throw new Error("Questo torneo non e piu apribile.");
  }

  const entry = tournament.entries[0];
  if (!entry) {
    throw new Error("La tua squadra non e tra le iscritte a questo torneo.");
  }

  if (entry.fantasyTeam.userId !== options.appUserId) {
    throw new Error("Solo il proprietario della squadra puo sbloccare l'accesso.");
  }

  if (!verifySecret(options.password, tournament.passwordHash)) {
    throw new Error("Password torneo non corretta.");
  }

  if (entry.activatedAt) {
    return {
      alreadyActivated: true as const,
      teamId: entry.fantasyTeam.id,
      teamName: entry.fantasyTeam.name,
      tournamentId: tournament.id,
      tournamentName: tournament.name
    };
  }

  await prisma.tournamentTeamEntry.update({
    where: { id: entry.id },
    data: { activatedAt: new Date() }
  });

  return {
    alreadyActivated: false as const,
    teamId: entry.fantasyTeam.id,
    teamName: entry.fantasyTeam.name,
    tournamentId: tournament.id,
    tournamentName: tournament.name
  };
}
