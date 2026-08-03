import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { DEFAULT_MAX_SUBSTITUTIONS } from "@/lib/scoring/calculate-team-score.ts";
import { hashSecret } from "@/lib/server/security/secret-hash.ts";

/** Dream Team: leghe fisse a 10 squadre (andata/ritorno = 18 giornate). */
export const REQUIRED_LEAGUE_MAX_TEAMS = 10;

export type CreateLeagueInput = {
  createdById: string;
  name: string;
  password: string;
};

export type CreateLeagueResult = {
  leagueId: string;
  maxTeams: number;
  name: string;
};

function normalizeLeagueName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function createLeague(
  input: CreateLeagueInput
): Promise<CreateLeagueResult> {
  const name = normalizeLeagueName(input.name);

  if (name.length === 0) {
    throw new Error("Il nome lega e obbligatorio.");
  }

  const password = input.password.trim();
  if (password.length === 0) {
    throw new Error("La password di iscrizione e obbligatoria.");
  }

  const passwordHash = hashSecret(password);

  const duplicateLeague = await prisma.league.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      }
    },
    select: {
      id: true
    }
  });

  if (duplicateLeague) {
    throw new Error("Esiste gia una lega con questo nome.");
  }

  try {
    const league = await prisma.league.create({
      data: {
        createdById: input.createdById,
        maxAutoSubs: DEFAULT_MAX_SUBSTITUTIONS,
        maxTeams: REQUIRED_LEAGUE_MAX_TEAMS,
        name,
        passwordHash,
        startersCount: 5
      },
      select: {
        id: true,
        maxTeams: true,
        name: true
      }
    });

    return {
      leagueId: league.id,
      maxTeams: league.maxTeams,
      name: league.name
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Esiste gia una lega con questo nome.");
    }

    throw error;
  }
}
