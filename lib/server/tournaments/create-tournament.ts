import { Prisma, TournamentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { hashSecret } from "@/lib/server/security/secret-hash.ts";

export type CreateTournamentInput = {
  createdById: string;
  name: string;
  password: string;
};

export type CreateTournamentResult = {
  name: string;
  tournamentId: string;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function createTournament(
  input: CreateTournamentInput
): Promise<CreateTournamentResult> {
  const name = normalizeName(input.name);

  if (name.length === 0) {
    throw new Error("Il nome torneo e obbligatorio.");
  }

  const password = input.password.trim();
  if (password.length === 0) {
    throw new Error("La password di iscrizione e obbligatoria.");
  }

  const passwordHash = hashSecret(password);

  const duplicate = await prisma.tournament.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      }
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new Error("Esiste gia un torneo con questo nome.");
  }

  try {
    const tournament = await prisma.tournament.create({
      data: {
        createdById: input.createdById,
        name,
        passwordHash,
        status: TournamentStatus.DRAFT
      },
      select: {
        id: true,
        name: true
      }
    });

    return {
      name: tournament.name,
      tournamentId: tournament.id
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Esiste gia un torneo con questo nome.");
    }

    throw error;
  }
}
