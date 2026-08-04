import { MatchdayStatus, TournamentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { calculateLeagueStandings } from "@/lib/server/standings/calculate-league-standings.ts";
import {
  ALLOWED_BRACKET_SIZES_LABEL,
  isAllowedBracketSize
} from "@/lib/tournaments/bracket-size.ts";

const EXPECTED_MATCHDAYS = 18;

export type TournamentEligibleTeam = {
  fantasyTeamId: string;
  leagueId: string;
  leagueName: string;
  leaguePoints: number;
  ownerEmail: string;
  ownerName: string | null;
  publishedMatchdays: number;
  seasonCompleteHint: boolean;
  teamName: string;
  totalMatchdays: number;
};

export type TournamentLeagueGroup = {
  leagueId: string;
  leagueName: string;
  publishedMatchdays: number;
  seasonCompleteHint: boolean;
  teams: TournamentEligibleTeam[];
  totalMatchdays: number;
};

export async function listTournamentEligibleTeams(): Promise<{
  groups: TournamentLeagueGroup[];
  teams: TournamentEligibleTeam[];
}> {
  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      fantasyTeams: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          user: {
            select: {
              displayName: true,
              email: true
            }
          }
        }
      },
      matchdays: {
        select: {
          status: true
        }
      }
    }
  });

  const teams: TournamentEligibleTeam[] = [];
  const groups: TournamentLeagueGroup[] = [];

  for (const league of leagues) {
    if (league.fantasyTeams.length === 0) {
      continue;
    }

    const totalMatchdays = league.matchdays.length;
    const publishedMatchdays = league.matchdays.filter(
      (matchday) =>
        matchday.status === MatchdayStatus.PUBLISHED ||
        matchday.status === MatchdayStatus.LOCKED
    ).length;
    const seasonCompleteHint =
      totalMatchdays >= EXPECTED_MATCHDAYS &&
      publishedMatchdays >= EXPECTED_MATCHDAYS;

    const standings = await calculateLeagueStandings(league.id);
    const pointsByTeam = new Map(
      standings.standings.map((row) => [row.teamId, row.leaguePoints])
    );

    const leagueTeams: TournamentEligibleTeam[] = league.fantasyTeams.map(
      (team) => ({
        fantasyTeamId: team.id,
        leagueId: league.id,
        leagueName: league.name,
        leaguePoints: pointsByTeam.get(team.id) ?? 0,
        ownerEmail: team.user.email,
        ownerName: team.user.displayName,
        publishedMatchdays,
        seasonCompleteHint,
        teamName: team.name,
        totalMatchdays
      })
    );

    leagueTeams.sort((left, right) => {
      if (right.leaguePoints !== left.leaguePoints) {
        return right.leaguePoints - left.leaguePoints;
      }

      return left.teamName.localeCompare(right.teamName, "it");
    });

    groups.push({
      leagueId: league.id,
      leagueName: league.name,
      publishedMatchdays,
      seasonCompleteHint,
      teams: leagueTeams,
      totalMatchdays
    });
    teams.push(...leagueTeams);
  }

  return { groups, teams };
}

export async function getTournamentEntriesPageData(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      entries: {
        select: {
          fantasyTeamId: true,
          seedPoints: true,
          sourceLeagueId: true,
          fantasyTeam: {
            select: {
              name: true
            }
          },
          sourceLeague: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ seedPoints: "desc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!tournament) {
    return null;
  }

  const eligible = await listTournamentEligibleTeams();
  const selectedIds = new Set(
    tournament.entries.map((entry) => entry.fantasyTeamId)
  );

  return {
    eligible,
    selectedIds,
    tournament
  };
}

export async function saveTournamentEntries(options: {
  fantasyTeamIds: string[];
  tournamentId: string;
}) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: options.tournamentId },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  if (!tournament) {
    throw new Error("Torneo non trovato.");
  }

  if (
    tournament.status !== TournamentStatus.DRAFT &&
    tournament.status !== TournamentStatus.ENTRIES_SET
  ) {
    throw new Error(
      "Il roster del torneo non e piu modificabile dopo la generazione del tabellone."
    );
  }

  const uniqueTeamIds = Array.from(new Set(options.fantasyTeamIds));

  if (uniqueTeamIds.length === 0) {
    throw new Error("Seleziona almeno una squadra.");
  }

  if (!isAllowedBracketSize(uniqueTeamIds.length)) {
    throw new Error(
      `Serve un numero di squadre tra ${ALLOWED_BRACKET_SIZES_LABEL}. Ora ne hai selezionate ${uniqueTeamIds.length}.`
    );
  }

  const teams = await prisma.fantasyTeam.findMany({
    where: {
      id: { in: uniqueTeamIds }
    },
    select: {
      id: true,
      leagueId: true,
      name: true
    }
  });

  if (teams.length !== uniqueTeamIds.length) {
    throw new Error("Una o piu squadre selezionate non esistono.");
  }

  const leagueIds = Array.from(new Set(teams.map((team) => team.leagueId)));
  const pointsByTeam = new Map<string, number>();
  const fantapuntiByTeam = new Map<string, number>();

  for (const leagueId of leagueIds) {
    const standings = await calculateLeagueStandings(leagueId);
    for (const row of standings.standings) {
      pointsByTeam.set(row.teamId, row.leaguePoints);
      fantapuntiByTeam.set(row.teamId, row.fantasyPointsTotal);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tournamentTeamEntry.deleteMany({
      where: { tournamentId: tournament.id }
    });

    await tx.tournamentTeamEntry.createMany({
      data: teams.map((team) => ({
        fantasyTeamId: team.id,
        seedFantapunti: fantapuntiByTeam.get(team.id) ?? 0,
        seedPoints: pointsByTeam.get(team.id) ?? 0,
        sourceLeagueId: team.leagueId,
        tournamentId: tournament.id
      }))
    });

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        status: TournamentStatus.ENTRIES_SET
      }
    });
  });

  return {
    count: teams.length,
    name: tournament.name,
    tournamentId: tournament.id
  };
}

export async function listTournamentsForAdmin() {
  return prisma.tournament.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          entries: true
        }
      }
    }
  });
}
