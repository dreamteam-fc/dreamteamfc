import { prisma } from "@/lib/prisma.ts";
import { calculateLeagueStandings } from "@/lib/server/standings/calculate-league-standings.ts";
import { findStandingTieGroups } from "@/lib/server/standings/compare-league-standings.ts";

/**
 * Persist admin order for a points/fantapunti/DR tie group.
 * `orderedTeamIds[0]` = best place among the group (rank 1).
 */
export async function setLeagueStandingsTieBreakOrder(options: {
  leagueId: string;
  orderedTeamIds: string[];
}) {
  const orderedTeamIds = Array.from(
    new Set(
      options.orderedTeamIds.map((id) => id.trim()).filter((id) => id.length > 0)
    )
  );

  if (orderedTeamIds.length < 2) {
    throw new Error("Servono almeno due squadre per risolvere una parità.");
  }

  if (orderedTeamIds.length !== options.orderedTeamIds.length) {
    throw new Error("Elenco squadre non valido (duplicati).");
  }

  const standingsResult = await calculateLeagueStandings(options.leagueId);
  const matchingGroup = findStandingTieGroups(standingsResult.standings).find(
    (group) => {
      if (group.length !== orderedTeamIds.length) {
        return false;
      }
      const groupIds = new Set(group.map((row) => row.teamId));
      return orderedTeamIds.every((teamId) => groupIds.has(teamId));
    }
  );

  if (!matchingGroup) {
    throw new Error(
      "Le squadre selezionate non formano una parità su punti, fantapunti e differenza reti."
    );
  }

  await prisma.$transaction(
    orderedTeamIds.map((teamId, index) =>
      prisma.fantasyTeam.update({
        where: { id: teamId },
        data: { standingsTieBreakRank: index + 1 }
      })
    )
  );

  return {
    leagueId: options.leagueId,
    orderedTeamIds
  };
}

export async function clearLeagueStandingsTieBreakOrder(options: {
  leagueId: string;
  teamIds: string[];
}) {
  const teamIds = Array.from(
    new Set(options.teamIds.map((id) => id.trim()).filter((id) => id.length > 0))
  );

  if (teamIds.length === 0) {
    throw new Error("Nessuna squadra da resettare.");
  }

  const updated = await prisma.fantasyTeam.updateMany({
    where: {
      leagueId: options.leagueId,
      id: { in: teamIds }
    },
    data: { standingsTieBreakRank: null }
  });

  if (updated.count !== teamIds.length) {
    throw new Error("Una o più squadre non appartengono a questa lega.");
  }

  return { cleared: updated.count, leagueId: options.leagueId };
}
