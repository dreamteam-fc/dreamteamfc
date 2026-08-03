import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus,
  TournamentStatus
} from "@prisma/client";

import type { AuthenticatedAppUserContext } from "@/lib/auth/app-user";
import { prisma } from "@/lib/prisma.ts";
import { validateLineupComposition } from "@/lib/server/lineups/validate-lineup-composition.ts";
import { validateRosterComposition } from "@/lib/server/rosters/validate-roster-composition.ts";
import {
  canManageLineup,
  canViewTeamAsCoachOrOwner,
  resolveTeamAccessRole
} from "@/lib/server/teams/team-access.ts";

export async function listPublicTournaments() {
  return prisma.tournament.findMany({
    where: {
      status: {
        in: [
          TournamentStatus.ENTRIES_SET,
          TournamentStatus.BRACKET_GENERATED,
          TournamentStatus.IN_PROGRESS,
          TournamentStatus.COMPLETED
        ]
      }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      lineupsOpen: true,
      _count: {
        select: {
          entries: true
        }
      }
    }
  });
}

export async function getUserTournamentActivationData(
  tournamentId: string,
  appUserId: string
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      entries: {
        where: {
          fantasyTeam: {
            userId: appUserId
          }
        },
        select: {
          activatedAt: true,
          fantasyTeamId: true,
          seedPoints: true,
          seedRank: true,
          fantasyTeam: {
            select: {
              id: true,
              name: true
            }
          },
          sourceLeague: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  return tournament;
}

export async function getUserTournamentFixtures(appUserId: string) {
  const ownedTeamIds = (
    await prisma.fantasyTeam.findMany({
      where: { userId: appUserId },
      select: { id: true }
    })
  ).map((team) => team.id);

  const coachedTeamIds = (
    await prisma.teamCoach.findMany({
      where: { userId: appUserId, revokedAt: null },
      select: { fantasyTeamId: true }
    })
  ).map((entry) => entry.fantasyTeamId);

  const teamIds = Array.from(new Set([...ownedTeamIds, ...coachedTeamIds]));

  if (teamIds.length === 0) {
    return [];
  }

  const fixtures = await prisma.tournamentFixture.findMany({
    where: {
      status: TournamentFixtureStatus.READY,
      OR: [
        { homeTeamId: { in: teamIds } },
        { awayTeamId: { in: teamIds } }
      ],
      round: {
        lineupsStatus: TournamentRoundLineupsStatus.OPEN,
        tournament: {
          status: {
            in: [
              TournamentStatus.BRACKET_GENERATED,
              TournamentStatus.IN_PROGRESS
            ]
          }
        }
      }
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      awayTeamId: true,
      homeTeamId: true,
      leg: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      lineups: {
        where: { fantasyTeamId: { in: teamIds } },
        select: {
          fantasyTeamId: true,
          status: true
        }
      },
      round: {
        select: {
          name: true,
          isFinal: true,
          tournament: {
            select: {
              id: true,
              name: true,
              entries: {
                where: { fantasyTeamId: { in: teamIds } },
                select: {
                  activatedAt: true,
                  fantasyTeamId: true
                }
              }
            }
          }
        }
      }
    }
  });

  const ownedTeamIdSet = new Set(ownedTeamIds);

  return fixtures.flatMap((fixture) => {
    const candidateTeamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(
      (teamId): teamId is string =>
        Boolean(teamId) && teamIds.includes(teamId as string)
    );

    return candidateTeamIds.map((myTeamId) => {
      const entry = fixture.round.tournament.entries.find(
        (item) => item.fantasyTeamId === myTeamId
      );

      return {
        activated: Boolean(entry?.activatedAt),
        awayTeam: fixture.awayTeam,
        fixtureId: fixture.id,
        hasLineup: fixture.lineups.some(
          (lineup) => lineup.fantasyTeamId === myTeamId
        ),
        homeTeam: fixture.homeTeam,
        isFinal: fixture.round.isFinal,
        isOwner: ownedTeamIdSet.has(myTeamId),
        leg: fixture.leg,
        myTeamId,
        myTeamName:
          fixture.homeTeamId === myTeamId
            ? (fixture.homeTeam?.name ?? "Squadra")
            : (fixture.awayTeam?.name ?? "Squadra"),
        roundName: fixture.round.name,
        tournamentId: fixture.round.tournament.id,
        tournamentName: fixture.round.tournament.name
      };
    });
  });
}

export async function getTournamentLineupPageData(
  fantasyTeamId: string,
  tournamentFixtureId: string,
  authContext: AuthenticatedAppUserContext
) {
  const appUser = authContext.appUser;
  if (!appUser) {
    return null;
  }

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: fantasyTeamId },
    select: {
      id: true,
      leagueId: true,
      name: true,
      userId: true,
      roster: {
        orderBy: [{ player: { role: "asc" } }, { player: { name: "asc" } }],
        select: {
          player: {
            select: {
              id: true,
              isActive: true,
              name: true,
              role: true,
              teamName: true
            }
          }
        }
      }
    }
  });

  if (!team) {
    return null;
  }

  const accessRole = await resolveTeamAccessRole({
    appUserId: appUser.id,
    appUserRole: appUser.role,
    teamId: team.id,
    teamOwnerId: team.userId
  });

  if (!canViewTeamAsCoachOrOwner(accessRole)) {
    return {
      accessDenied: true as const,
      team: { id: team.id, name: team.name }
    };
  }

  const fixture = await prisma.tournamentFixture.findUnique({
    where: { id: tournamentFixtureId },
    select: {
      id: true,
      awayTeamId: true,
      homeTeamId: true,
      leg: true,
      status: true,
      awayTeam: { select: { id: true, name: true } },
      homeTeam: { select: { id: true, name: true } },
      round: {
        select: {
          name: true,
          isFinal: true,
          lineupsStatus: true,
          tournament: {
            select: {
              id: true,
              name: true,
              status: true,
              entries: {
                where: { fantasyTeamId },
                select: { activatedAt: true }
              }
            }
          }
        }
      },
      lineups: {
        where: { fantasyTeamId },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          players: {
            orderBy: [{ slotType: "asc" }, { positionOrder: "asc" }],
            select: {
              id: true,
              playerId: true,
              positionOrder: true,
              slotType: true,
              player: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!fixture) {
    return null;
  }

  const isParticipant =
    fixture.homeTeamId === fantasyTeamId ||
    fixture.awayTeamId === fantasyTeamId;

  if (!isParticipant) {
    return null;
  }

  const tournament = fixture.round.tournament;
  const activated = Boolean(tournament.entries[0]?.activatedAt);
  const blocked = await prisma.leagueBlockedPlayer.findMany({
    where: {
      leagueId: team.leagueId,
      playerId: { in: team.roster.map((entry) => entry.player.id) }
    },
    select: { playerId: true }
  });
  const blockedIds = new Set(blocked.map((entry) => entry.playerId));

  const rosterValidation = validateRosterComposition(
    team.roster.map((entry) => ({
      isBlockedInLeague: blockedIds.has(entry.player.id),
      isGloballyInactive: !entry.player.isActive,
      role: entry.player.role
    }))
  );

  const existingLineup = fixture.lineups[0] ?? null;
  const starterPlayers =
    existingLineup?.players
      .filter((entry) => entry.slotType === "STARTER")
      .map((entry) => ({
        id: entry.player.id,
        role: entry.player.role
      })) ?? [];
  const benchPlayers =
    existingLineup?.players
      .filter((entry) => entry.slotType === "BENCH")
      .map((entry) => ({
        id: entry.player.id,
        role: entry.player.role
      })) ?? [];

  return {
    accessDenied: false as const,
    accessRole,
    activated,
    canEdit:
      canManageLineup(accessRole) &&
      activated &&
      fixture.round.lineupsStatus === TournamentRoundLineupsStatus.OPEN &&
      fixture.status === TournamentFixtureStatus.READY &&
      (tournament.status === TournamentStatus.BRACKET_GENERATED ||
        tournament.status === TournamentStatus.IN_PROGRESS) &&
      rosterValidation.isValid,
    existingLineup,
    existingLineupValidation: existingLineup
      ? validateLineupComposition(starterPlayers, benchPlayers)
      : null,
    fixture,
    rosterPlayers: team.roster.map((entry) => ({
      id: entry.player.id,
      isActive: entry.player.isActive,
      isBlockedInLeague: blockedIds.has(entry.player.id),
      name: entry.player.name,
      role: entry.player.role,
      teamName: entry.player.teamName
    })),
    rosterValidation,
    team: { id: team.id, name: team.name },
    tournament
  };
}
