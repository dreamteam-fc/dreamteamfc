import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

const DELETABLE_MATCHDAY_STATUSES: MatchdayStatus[] = [
  MatchdayStatus.DRAFT,
  MatchdayStatus.LINEUPS_OPEN,
  MatchdayStatus.LINEUPS_LOCKED
];

export type DeleteMatchdayLineupResult = {
  fantasyTeamId: string;
  fantasyTeamName: string;
  leagueId: string;
  lineupId: string;
  matchdayId: string;
  matchdayNumber: number;
};

/**
 * Admin/Mister: remove one team's lineup for a matchday (before scores).
 * Cascades LineupPlayer. Blocked once a TeamScore exists or giornata is past lock+votes pipeline start of scoring.
 */
export async function deleteMatchdayLineup(options: {
  fantasyTeamId: string;
  matchdayId: string;
}): Promise<DeleteMatchdayLineupResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: options.matchdayId },
    select: {
      id: true,
      leagueId: true,
      number: true,
      status: true
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata.");
  }

  if (!DELETABLE_MATCHDAY_STATUSES.includes(matchday.status)) {
    throw new Error(
      "Puoi eliminare una formazione solo finché la giornata è DRAFT, LINEUPS_OPEN o LINEUPS_LOCKED (prima di voti/punteggi)."
    );
  }

  const lineup = await prisma.lineup.findUnique({
    where: {
      fantasyTeamId_matchdayId: {
        fantasyTeamId: options.fantasyTeamId,
        matchdayId: options.matchdayId
      }
    },
    select: {
      id: true,
      fantasyTeam: {
        select: {
          id: true,
          name: true,
          leagueId: true
        }
      },
      teamScore: {
        select: { id: true }
      }
    }
  });

  if (!lineup) {
    throw new Error("Nessuna formazione da eliminare per questa squadra.");
  }

  if (lineup.fantasyTeam.leagueId !== matchday.leagueId) {
    throw new Error("La squadra non appartiene a questa giornata/lega.");
  }

  if (lineup.teamScore) {
    throw new Error(
      "Impossibile eliminare: esistono già i punteggi per questa formazione. Ricalcola/resetta i punteggi prima."
    );
  }

  await prisma.lineup.delete({
    where: { id: lineup.id }
  });

  return {
    fantasyTeamId: lineup.fantasyTeam.id,
    fantasyTeamName: lineup.fantasyTeam.name,
    leagueId: matchday.leagueId,
    lineupId: lineup.id,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number
  };
}
