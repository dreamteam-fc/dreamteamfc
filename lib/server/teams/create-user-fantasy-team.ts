import { LeagueRole, Prisma } from "@prisma/client";

import { hasLeagueScheduleGeneratedWithDb } from "@/lib/server/leagues/has-league-schedule-generated.ts";
import { prisma } from "@/lib/prisma.ts";
import { verifySecret } from "@/lib/server/security/secret-hash.ts";

export type CreateUserFantasyTeamInput = {
  appUserId: string;
  leagueId: string;
  password: string;
  teamName: string;
};

export type CreateUserFantasyTeamResult = {
  teamId: string;
};

function normalizeTeamName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function createUserFantasyTeam(
  input: CreateUserFantasyTeamInput
): Promise<CreateUserFantasyTeamResult> {
  const teamName = normalizeTeamName(input.teamName);

  if (teamName.length === 0) {
    throw new Error("Il nome squadra e obbligatorio.");
  }

  if (teamName.length > 50) {
    throw new Error("Il nome squadra deve avere massimo 50 caratteri.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const league = await tx.league.findUnique({
        where: {
          id: input.leagueId
        },
        select: {
          _count: {
            select: {
              fantasyTeams: true
            }
          },
          id: true,
          maxTeams: true,
          passwordHash: true
        }
      });

      if (!league) {
        throw new Error("Lega non trovata.");
      }

      if (!league.passwordHash) {
        throw new Error(
          "Questa lega non ha una password di iscrizione configurata. Contatta l'admin."
        );
      }

      if (!verifySecret(input.password, league.passwordHash)) {
        throw new Error("Password di lega non valida.");
      }

      if (await hasLeagueScheduleGeneratedWithDb(tx, input.leagueId)) {
        throw new Error(
          "Le iscrizioni sono chiuse perché il calendario è già stato generato."
        );
      }

      const existingTeam = await tx.fantasyTeam.findUnique({
        where: {
          leagueId_userId: {
            leagueId: input.leagueId,
            userId: input.appUserId
          }
        },
        select: {
          id: true,
          name: true
        }
      });

      if (existingTeam) {
        throw new Error("Hai gia una squadra in questa lega.");
      }

      if (league._count.fantasyTeams >= league.maxTeams) {
        throw new Error("La lega ha raggiunto il numero massimo di squadre.");
      }

      const duplicateName = await tx.fantasyTeam.findFirst({
        where: {
          leagueId: input.leagueId,
          name: {
            equals: teamName,
            mode: "insensitive"
          }
        },
        select: {
          id: true
        }
      });

      if (duplicateName) {
        throw new Error("Esiste gia una squadra con questo nome nella lega.");
      }

      await tx.leagueMember.upsert({
        where: {
          leagueId_userId: {
            leagueId: input.leagueId,
            userId: input.appUserId
          }
        },
        update: {},
        create: {
          leagueId: input.leagueId,
          role: LeagueRole.MEMBER,
          userId: input.appUserId
        }
      });

      const team = await tx.fantasyTeam.create({
        data: {
          leagueId: input.leagueId,
          name: teamName,
          userId: input.appUserId
        },
        select: {
          id: true
        }
      });

      return {
        teamId: team.id
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Hai gia una squadra in questa lega.");
    }

    throw error;
  }
}
