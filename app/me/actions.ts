"use server";

import {
  LineupStatus,
  MatchdayStatus,
  Prisma,
  SlotType,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import {
  acceptTeamCoachInvite,
  createTeamCoachInvite,
  regenerateTeamCoachInvite,
  revokeActiveTeamCoach,
  revokeTeamCoachInvite
} from "@/lib/server/coaches/team-coach-invites.ts";
import { activateTournamentEntry } from "@/lib/server/tournaments/activate-tournament-entry.ts";
import { saveTournamentLineup } from "@/lib/server/tournaments/save-tournament-lineup.ts";
import { hasLeagueScheduleGeneratedWithDb } from "@/lib/server/leagues/has-league-schedule-generated.ts";
import type { PlayerRoleFilter } from "@/lib/players/player-role.ts";
import { parsePlayerRoleFilter } from "@/lib/players/player-role.ts";
import { prisma } from "@/lib/prisma.ts";
import { getActionErrorMessage } from "@/lib/server/http/action-errors.ts";
import { validateLineupComposition } from "@/lib/server/lineups/validate-lineup-composition";
import {
  assertPlayerFreeInLeague,
  isLeaguePlayerExclusivityConflict,
  PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR
} from "@/lib/server/rosters/league-player-exclusivity.ts";
import { assertCanEditTeamRoster } from "@/lib/server/rosters/roster-edit-policy";
import {
  REQUIRED_ROSTER_SIZE,
  validateRosterComposition
} from "@/lib/server/rosters/validate-roster-composition";
import { createUserFantasyTeam } from "@/lib/server/teams/create-user-fantasy-team";
import {
  canManageLineup,
  resolveTeamAccessRole
} from "@/lib/server/teams/team-access.ts";

function buildJoinLeagueRedirectPath(leagueId: string, error?: string) {
  const searchParams = new URLSearchParams();

  if (error) {
    searchParams.set("error", error);
  }

  const search = searchParams.toString();
  return search.length > 0
    ? `/leagues/${leagueId}/join?${search}`
    : `/leagues/${leagueId}/join`;
}

function buildTeamRedirectPath(
  teamId: string,
  options?: {
    coachInviteToken?: string;
    error?: string;
    notice?: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (options?.error) {
    searchParams.set("error", options.error);
  }

  if (options?.notice) {
    searchParams.set("notice", options.notice);
  }

  if (options?.coachInviteToken) {
    searchParams.set("coachInviteToken", options.coachInviteToken);
  }

  const search = searchParams.toString();
  const pathname = `/me/teams/${teamId}`;

  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

function buildRosterRedirectPath(
  teamId: string,
  roleFilter?: string | null,
  searchQuery?: string | null,
  options?: {
    error?: string;
    notice?: string;
  }
) {
  const searchParams = new URLSearchParams();
  const parsedFilter = parsePlayerRoleFilter(roleFilter);

  searchParams.set("role", parsedFilter);

  if (typeof searchQuery === "string" && searchQuery.trim().length > 0) {
    searchParams.set("q", searchQuery.trim());
  }

  if (options?.error) {
    searchParams.set("error", options.error);
  }

  if (options?.notice) {
    searchParams.set("notice", options.notice);
  }

  return `/me/teams/${teamId}/roster?${searchParams.toString()}`;
}

function buildLineupRedirectPath(
  teamId: string,
  matchdayId: string,
  options?: {
    error?: string;
    notice?: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (options?.error) {
    searchParams.set("error", options.error);
  }

  if (options?.notice) {
    searchParams.set("notice", options.notice);
  }

  const search = searchParams.toString();
  const pathname = `/me/teams/${teamId}/matchdays/${matchdayId}/lineup`;

  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

async function assertTeamOwnerOrAdmin(teamId: string) {
  return requireOwnedFantasyTeam(teamId);
}

async function requireLineupAccess(teamId: string) {
  const authContext = await requireAuthenticatedAppUser(`/me/teams/${teamId}`);
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      leagueId: true,
      userId: true,
      league: {
        select: {
          members: {
            select: { id: true },
            take: 1,
            where: { userId: authContext.appUser.id }
          }
        }
      }
    }
  });

  if (!team) {
    throw new Error("Squadra non trovata.");
  }

  const accessRole = await resolveTeamAccessRole({
    appUserId: authContext.appUser.id,
    appUserRole: authContext.appUser.role,
    teamId: team.id,
    teamOwnerId: team.userId
  });

  if (!canManageLineup(accessRole)) {
    throw new Error("Non autorizzato.");
  }

  const isAdmin = accessRole === "admin";
  const isOwner = accessRole === "owner";
  const isCoach = accessRole === "coach";

  if (isOwner && team.league.members.length === 0) {
    throw new Error("Non autorizzato.");
  }

  return {
    accessRole,
    appUserId: authContext.appUser.id,
    isAdmin,
    isCoach,
    isOwner,
    team: {
      id: team.id,
      leagueId: team.leagueId,
      userId: team.userId
    }
  };
}

async function requireOwnedFantasyTeam(
  teamId: string,
  options?: {
    allowAdmin?: boolean;
  }
) {
  const authContext = await requireAuthenticatedAppUser(`/me/teams/${teamId}`);
  const allowAdmin = options?.allowAdmin ?? true;
  const team = await prisma.fantasyTeam.findUnique({
    where: {
      id: teamId
    },
    select: {
      id: true,
      league: {
        select: {
          members: {
            select: {
              id: true
            },
            take: 1,
            where: {
              userId: authContext.appUser.id
            }
          }
        }
      },
      leagueId: true,
      userId: true
    }
  });

  if (!team) {
    throw new Error("Squadra non trovata.");
  }

  const canAccess =
    (allowAdmin && authContext.appUser.role === UserRole.ADMIN) ||
    authContext.appUser.id === team.userId;

  if (!canAccess) {
    throw new Error("Non autorizzato.");
  }

  const isAdmin = authContext.appUser.role === UserRole.ADMIN;

  if (!isAdmin && team.league.members.length === 0) {
    throw new Error("Non autorizzato.");
  }

  return {
    appUserId: authContext.appUser.id,
    isAdmin,
    team: {
      id: team.id,
      leagueId: team.leagueId,
      userId: team.userId
    }
  };
}

async function assertLeagueMemberInTransaction(
  tx: Prisma.TransactionClient,
  leagueId: string,
  userId: string
) {
  const membership = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId
      }
    },
    select: {
      id: true
    }
  });

  if (!membership) {
    throw new Error("Non autorizzato.");
  }
}

function revalidateRosterPaths(teamId: string) {
  revalidatePath("/me");
  revalidatePath(`/me/teams/${teamId}`);
  revalidatePath(`/me/teams/${teamId}/roster`);
}

function revalidateLineupPaths(teamId: string, matchdayId: string, leagueId?: string) {
  revalidatePath("/me");
  revalidatePath(`/me/teams/${teamId}`);
  revalidatePath(`/me/teams/${teamId}/matchdays/${matchdayId}/lineup`);

  if (leagueId) {
    revalidatePath(`/leagues/${leagueId}`);
  }
}

export async function createFantasyTeamAction(formData: FormData) {
  const rawLeagueId = formData.get("leagueId");
  const rawTeamName = formData.get("teamName");
  const rawPassword = formData.get("password");

  const leagueId = typeof rawLeagueId === "string" ? rawLeagueId : "";
  const teamName = typeof rawTeamName === "string" ? rawTeamName : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (leagueId.trim().length === 0) {
    redirect("/me");
  }

  const authContext = await requireAuthenticatedAppUser(
    `/leagues/${leagueId}/join`
  );

  try {
    const result = await createUserFantasyTeam({
      appUserId: authContext.appUser.id,
      leagueId,
      password,
      teamName
    });

    revalidatePath("/me");
    revalidatePath(`/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}/join`);

    redirect(`/me/teams/${result.teamId}`);
  } catch (error) {
    redirect(
      buildJoinLeagueRedirectPath(
        leagueId,
        getActionErrorMessage(
          error,
          "Impossibile creare la squadra fantasy."
        )
      )
    );
  }
}

export async function leaveLeagueAction(teamId: string, formData: FormData) {
  const access = await requireOwnedFantasyTeam(teamId, { allowAdmin: false });
  const confirmation = formData.get("confirmLeaveLeague");

  if (confirmation !== "yes") {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: "Devi confermare l'abbandono della lega."
      })
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.fantasyTeam.findUnique({
        where: {
          id: teamId
        },
        select: {
          _count: {
            select: {
              awayFixtures: true,
              homeFixtures: true,
              lineups: true,
              teamScores: true
            }
          },
          id: true,
          leagueId: true,
          userId: true
        }
      });

      if (!team) {
        throw new Error("Squadra non trovata.");
      }

      if (team.userId !== access.appUserId) {
        throw new Error("Non autorizzato.");
      }

      await assertLeagueMemberInTransaction(tx, team.leagueId, access.appUserId);

      if (await hasLeagueScheduleGeneratedWithDb(tx, team.leagueId)) {
        throw new Error(
          "Non puoi abbandonare questa lega perché il calendario è già stato generato."
        );
      }

      const hasParticipationHistory =
        team._count.lineups > 0 ||
        team._count.teamScores > 0 ||
        team._count.homeFixtures > 0 ||
        team._count.awayFixtures > 0;

      if (hasParticipationHistory) {
        throw new Error(
          "Non puoi abbandonare questa lega perche la squadra ha gia partecipato a una giornata."
        );
      }

      await tx.fantasyRoster.deleteMany({
        where: {
          fantasyTeamId: team.id
        }
      });

      await tx.leagueMember.deleteMany({
        where: {
          leagueId: team.leagueId,
          userId: team.userId
        }
      });

      await tx.fantasyTeam.delete({
        where: {
          id: team.id
        }
      });

      return {
        leagueId: team.leagueId
      };
    });

    revalidatePath("/me");
    revalidatePath(`/leagues/${result.leagueId}`);
    revalidatePath(`/leagues/${result.leagueId}/join`);

    redirect("/me?notice=Hai%20abbandonato%20la%20lega.");
  } catch (error) {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: getActionErrorMessage(
          error,
          "Impossibile abbandonare la lega."
        )
      })
    );
  }
}

export async function addPlayerToRosterAction(
  teamId: string,
  playerId: string,
  currentRoleFilter: PlayerRoleFilter | undefined,
  currentSearchQuery: string | undefined,
  _formData: FormData
) {
  const access = await assertTeamOwnerOrAdmin(teamId);

  try {
    await prisma.$transaction(async (tx) => {
      const fullTeam = await tx.fantasyTeam.findUnique({
        where: {
          id: access.team.id
        },
        select: {
          id: true,
          leagueId: true,
          roster: {
            select: {
              id: true,
              playerId: true
            }
          }
        }
      });

      if (!fullTeam) {
        throw new Error("Squadra non trovata.");
      }

      if (!access.isAdmin) {
        await assertLeagueMemberInTransaction(tx, fullTeam.leagueId, access.appUserId);
      }

      const player = await tx.player.findUnique({
        where: {
          id: playerId
        },
        select: {
          id: true,
          isActive: true,
          name: true
        }
      });

      if (!player || !player.isActive) {
        throw new Error("Giocatore non disponibile.");
      }

      const blockedPlayer = await tx.leagueBlockedPlayer.findUnique({
        where: {
          leagueId_playerId: {
            leagueId: fullTeam.leagueId,
            playerId: player.id
          }
        },
        select: {
          id: true
        }
      });

      if (blockedPlayer) {
        throw new Error("Questo giocatore non e disponibile in questa lega.");
      }

      if (fullTeam.roster.some((entry) => entry.playerId === player.id)) {
        throw new Error("Questo giocatore e gia presente nella rosa.");
      }

      await assertPlayerFreeInLeague(
        {
          leagueId: fullTeam.leagueId,
          playerId: player.id,
          exceptFantasyTeamId: fullTeam.id
        },
        tx
      );

      assertCanEditTeamRoster({
        mode: access.isAdmin ? "admin" : "owner",
        rosterPlayerCount: fullTeam.roster.length
      });

      if (fullTeam.roster.length >= REQUIRED_ROSTER_SIZE) {
        throw new Error(
          `La rosa ha gia raggiunto il limite di ${REQUIRED_ROSTER_SIZE} giocatori.`
        );
      }

      await tx.fantasyRoster.create({
        data: {
          fantasyTeamId: fullTeam.id,
          leagueId: fullTeam.leagueId,
          playerId: player.id
        }
      });
    });

    revalidateRosterPaths(teamId);
    redirect(
      buildRosterRedirectPath(teamId, currentRoleFilter, currentSearchQuery, {
        notice: "Giocatore aggiunto alla rosa."
      })
    );
  } catch (error) {
    const errorMessage = isLeaguePlayerExclusivityConflict(error)
      ? PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR
      : error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ? "Questo giocatore e gia presente nella rosa."
        : getActionErrorMessage(
            error,
            "Impossibile aggiungere il giocatore alla rosa."
          );

    redirect(
      buildRosterRedirectPath(teamId, currentRoleFilter, currentSearchQuery, {
        error: errorMessage
      })
    );
  }
}

export async function removePlayerFromRosterAction(
  teamId: string,
  playerId: string,
  currentRoleFilter: PlayerRoleFilter | undefined,
  currentSearchQuery: string | undefined,
  _formData: FormData
) {
  const access = await assertTeamOwnerOrAdmin(teamId);

  try {
    await prisma.$transaction(async (tx) => {
      if (!access.isAdmin) {
        await assertLeagueMemberInTransaction(tx, access.team.leagueId, access.appUserId);
      }

      const rosterPlayerCount = await tx.fantasyRoster.count({
        where: {
          fantasyTeamId: access.team.id
        }
      });

      assertCanEditTeamRoster({
        mode: access.isAdmin ? "admin" : "owner",
        rosterPlayerCount
      });

      const rosterEntry = await tx.fantasyRoster.findUnique({
        where: {
          fantasyTeamId_playerId: {
            fantasyTeamId: access.team.id,
            playerId
          }
        },
        select: {
          id: true
        }
      });

      if (!rosterEntry) {
        throw new Error("Il giocatore non e presente nella rosa.");
      }

      await tx.fantasyRoster.delete({
        where: {
          id: rosterEntry.id
        }
      });
    });

    revalidateRosterPaths(teamId);
    redirect(
      buildRosterRedirectPath(teamId, currentRoleFilter, currentSearchQuery, {
        notice: "Giocatore rimosso dalla rosa."
      })
    );
  } catch (error) {
    redirect(
      buildRosterRedirectPath(teamId, currentRoleFilter, currentSearchQuery, {
        error: getActionErrorMessage(
          error,
          "Impossibile rimuovere il giocatore dalla rosa."
        )
      })
    );
  }
}

type LineupSelection = "NONE" | "STARTER" | "BENCH";

function parseLineupSelection(value: FormDataEntryValue | null): LineupSelection {
  if (value === "STARTER" || value === "BENCH") {
    return value;
  }

  return "NONE";
}

function parseBenchOrder(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

export async function saveLineupAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const rawMatchdayId = formData.get("matchdayId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const matchdayId = typeof rawMatchdayId === "string" ? rawMatchdayId : "";

  if (teamId.length === 0 || matchdayId.length === 0) {
    redirect("/me");
  }

  const access = await requireLineupAccess(teamId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fullTeam = await tx.fantasyTeam.findUnique({
        where: {
          id: access.team.id
        },
        select: {
          id: true,
          leagueId: true,
          roster: {
            orderBy: [{ player: { role: "asc" } }, { player: { name: "asc" } }],
            select: {
              playerId: true,
              player: {
                select: {
                  id: true,
                  isActive: true,
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      });

      if (!fullTeam) {
        throw new Error("Squadra non trovata.");
      }

      if (access.isOwner) {
        await assertLeagueMemberInTransaction(tx, fullTeam.leagueId, access.appUserId);
      }

      const matchday = await tx.matchday.findUnique({
        where: {
          id: matchdayId
        },
        select: {
          id: true,
          leagueId: true,
          status: true
        }
      });

      if (!matchday || matchday.leagueId !== fullTeam.leagueId) {
        throw new Error("Giornata non valida per questa squadra.");
      }

      if (matchday.status !== MatchdayStatus.LINEUPS_OPEN) {
        throw new Error("Giornata non modificabile.");
      }

      const rosterPlayerMap = new Map(
        fullTeam.roster.map((entry) => [entry.player.id, entry.player])
      );

      const blockedRosterPlayers = await tx.leagueBlockedPlayer.findMany({
        where: {
          leagueId: fullTeam.leagueId,
          playerId: {
            in: fullTeam.roster.map((entry) => entry.player.id)
          }
        },
        select: {
          playerId: true
        }
      });
      const blockedRosterPlayerIds = new Set(
        blockedRosterPlayers.map((entry) => entry.playerId)
      );
      const rosterComposition = validateRosterComposition(
        fullTeam.roster.map((entry) => ({
          isBlockedInLeague: blockedRosterPlayerIds.has(entry.player.id),
          isGloballyInactive: !entry.player.isActive,
          role: entry.player.role
        }))
      );

      if (!rosterComposition.isValid) {
        if (rosterComposition.blockedCount > 0) {
          throw new Error("Uno o piu giocatori non sono disponibili.");
        }

        throw new Error("Completa prima la rosa.");
      }

      const starters: Array<{ id: string; role: (typeof fullTeam.roster)[number]["player"]["role"] }> =
        [];
      const benchSelections: Array<{
        id: string;
        order: number | null;
        role: (typeof fullTeam.roster)[number]["player"]["role"];
      }> = [];

      for (const rosterEntry of fullTeam.roster) {
        const selection = parseLineupSelection(
          formData.get(`playerSelection:${rosterEntry.player.id}`)
        );

        if (selection === "STARTER") {
          starters.push({
            id: rosterEntry.player.id,
            role: rosterEntry.player.role
          });
        }

        if (selection === "BENCH") {
          benchSelections.push({
            id: rosterEntry.player.id,
            order: parseBenchOrder(formData.get(`benchOrder:${rosterEntry.player.id}`)),
            role: rosterEntry.player.role
          });
        }
      }

      if (benchSelections.some((entry) => entry.order === null)) {
        throw new Error("Ogni panchinaro deve avere un ordine tra 1 e 4.");
      }

      const benchOrders = benchSelections.map((entry) => entry.order as number);
      const sortedBenchOrders = [...benchOrders].sort((left, right) => left - right);
      const hasValidBenchOrderSequence =
        sortedBenchOrders.length === 4 &&
        sortedBenchOrders[0] === 1 &&
        sortedBenchOrders[1] === 2 &&
        sortedBenchOrders[2] === 3 &&
        sortedBenchOrders[3] === 4;

      if (!hasValidBenchOrderSequence) {
        throw new Error("La panchina deve avere ordini unici 1, 2, 3 e 4.");
      }

      const duplicateCheck = new Set<string>();
      for (const player of [...starters, ...benchSelections]) {
        if (!rosterPlayerMap.has(player.id)) {
          throw new Error("Tutti i giocatori selezionati devono appartenere alla rosa.");
        }

        if (duplicateCheck.has(player.id)) {
          throw new Error("Non puoi usare lo stesso giocatore due volte nella formazione.");
        }

        duplicateCheck.add(player.id);
      }

      const selectedBlockedPlayers = await tx.leagueBlockedPlayer.findMany({
        where: {
          leagueId: fullTeam.leagueId,
          playerId: {
            in: [...duplicateCheck]
          }
        },
        select: {
          playerId: true
        }
      });

      if (selectedBlockedPlayers.length > 0) {
        throw new Error("Uno o piu giocatori non sono disponibili.");
      }

      const selectedInactivePlayers = [...duplicateCheck].filter((playerId) => {
        const rosterPlayer = rosterPlayerMap.get(playerId);
        return rosterPlayer ? !rosterPlayer.isActive : false;
      });

      if (selectedInactivePlayers.length > 0) {
        throw new Error("Uno o piu giocatori non sono disponibili.");
      }

      const lineupValidation = validateLineupComposition(
        starters,
        benchSelections.map((entry) => ({
          id: entry.id,
          role: entry.role
        }))
      );

      if (!lineupValidation.isValid) {
        throw new Error(lineupValidation.errors[0] ?? "Formazione non valida.");
      }

      const existingLineup = await tx.lineup.findUnique({
        where: {
          fantasyTeamId_matchdayId: {
            fantasyTeamId: fullTeam.id,
            matchdayId: matchday.id
          }
        },
        select: {
          id: true
        }
      });

      const lineup = existingLineup
        ? await tx.lineup.update({
            where: {
              id: existingLineup.id
            },
            data: {
              status: LineupStatus.SUBMITTED,
              submittedAt: new Date()
            },
            select: {
              id: true
            }
          })
        : await tx.lineup.create({
            data: {
              fantasyTeamId: fullTeam.id,
              matchdayId: matchday.id,
              status: LineupStatus.SUBMITTED,
              submittedAt: new Date()
            },
            select: {
              id: true
            }
          });

      await tx.lineupPlayer.deleteMany({
        where: {
          lineupId: lineup.id
        }
      });

      const orderedBenchSelections = [...benchSelections].sort(
        (left, right) => (left.order as number) - (right.order as number)
      );

      await tx.lineupPlayer.createMany({
        data: [
          ...starters.map((player, index) => ({
            lineupId: lineup.id,
            playerId: player.id,
            positionOrder: index + 1,
            slotType: SlotType.STARTER
          })),
          ...orderedBenchSelections.map((player) => ({
            lineupId: lineup.id,
            playerId: player.id,
            positionOrder: player.order as number,
            slotType: SlotType.BENCH
          }))
        ]
      });

      return {
        leagueId: fullTeam.leagueId
      };
    });

    revalidateLineupPaths(teamId, matchdayId, result.leagueId);
    redirect(
      buildLineupRedirectPath(teamId, matchdayId, {
        notice: "Formazione salvata."
      })
    );
  } catch (error) {
    redirect(
      buildLineupRedirectPath(teamId, matchdayId, {
        error: getActionErrorMessage(
          error,
          "Impossibile salvare la formazione."
        )
      })
    );
  }
}

export async function inviteTeamCoachAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const rawEmail = formData.get("inviteeEmail");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const inviteeEmail = typeof rawEmail === "string" ? rawEmail : "";

  if (teamId.length === 0) {
    redirect("/me");
  }

  const access = await requireOwnedFantasyTeam(teamId, { allowAdmin: false });

  try {
    const invite = await createTeamCoachInvite({
      fantasyTeamId: access.team.id,
      invitedById: access.appUserId,
      inviteeEmail
    });

    revalidatePath(`/me/teams/${teamId}`);
    redirect(
      buildTeamRedirectPath(teamId, {
        coachInviteToken: invite.token,
        notice: `Invito creato per ${invite.inviteeEmail}. Copia il link qui sotto e invialo all'allenatore.`
      })
    );
  } catch (error) {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: getActionErrorMessage(
          error,
          "Impossibile creare l'invito allenatore."
        )
      })
    );
  }
}

export async function revokeTeamCoachInviteAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const rawInviteId = formData.get("inviteId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const inviteId = typeof rawInviteId === "string" ? rawInviteId : "";

  if (teamId.length === 0 || inviteId.length === 0) {
    redirect("/me");
  }

  const access = await requireOwnedFantasyTeam(teamId, { allowAdmin: false });

  try {
    await revokeTeamCoachInvite({
      inviteId,
      ownerUserId: access.appUserId
    });
    revalidatePath(`/me/teams/${teamId}`);
    redirect(
      buildTeamRedirectPath(teamId, {
        notice: "Invito allenatore revocato."
      })
    );
  } catch (error) {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: getActionErrorMessage(
          error,
          "Impossibile revocare l'invito."
        )
      })
    );
  }
}

export async function regenerateTeamCoachInviteAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const rawInviteId = formData.get("inviteId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const inviteId = typeof rawInviteId === "string" ? rawInviteId : "";

  if (teamId.length === 0 || inviteId.length === 0) {
    redirect("/me");
  }

  const access = await requireOwnedFantasyTeam(teamId, { allowAdmin: false });

  try {
    const invite = await regenerateTeamCoachInvite({
      inviteId,
      ownerUserId: access.appUserId
    });

    revalidatePath(`/me/teams/${teamId}`);
    redirect(
      buildTeamRedirectPath(teamId, {
        coachInviteToken: invite.token,
        notice: `Nuovo link creato per ${invite.inviteeEmail}. Il link precedente non e piu valido. Copia il link qui sotto e invialo all'allenatore.`
      })
    );
  } catch (error) {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: getActionErrorMessage(
          error,
          "Impossibile rigenerare il link invito."
        )
      })
    );
  }
}

export async function revokeTeamCoachAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";

  if (teamId.length === 0) {
    redirect("/me");
  }

  const access = await requireOwnedFantasyTeam(teamId, { allowAdmin: false });

  try {
    await revokeActiveTeamCoach({
      fantasyTeamId: access.team.id,
      ownerUserId: access.appUserId
    });
    revalidatePath("/me");
    revalidatePath(`/me/teams/${teamId}`);
    redirect(
      buildTeamRedirectPath(teamId, {
        notice: "Allenatore rimosso."
      })
    );
  } catch (error) {
    redirect(
      buildTeamRedirectPath(teamId, {
        error: getActionErrorMessage(
          error,
          "Impossibile rimuovere l'allenatore."
        )
      })
    );
  }
}

export async function acceptTeamCoachInviteAction(formData: FormData) {
  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (token.length === 0) {
    redirect("/me");
  }

  const authContext = await requireAuthenticatedAppUser(
    `/me/coach-invites/${token}`
  );

  try {
    const result = await acceptTeamCoachInvite({
      token,
      appUserId: authContext.appUser.id,
      appUserEmail: authContext.appUser.email
    });

    revalidatePath("/me");
    revalidatePath(`/me/teams/${result.teamId}`);
    redirect(
      `/me/teams/${result.teamId}?notice=${encodeURIComponent(
        `Ora sei allenatore di ${result.teamName}. Puoi solo impostare le formazioni.`
      )}`
    );
  } catch (error) {
    redirect(
      `/me/coach-invites/${token}?error=${encodeURIComponent(
        getActionErrorMessage(error, "Impossibile accettare l'invito.")
      )}`
    );
  }
}

export async function activateTournamentEntryAction(formData: FormData) {
  const rawTournamentId = formData.get("tournamentId");
  const rawTeamId = formData.get("fantasyTeamId");
  const rawPassword = formData.get("password");
  const tournamentId =
    typeof rawTournamentId === "string" ? rawTournamentId : "";
  const fantasyTeamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (tournamentId.length === 0 || fantasyTeamId.length === 0) {
    redirect("/me");
  }

  const authContext = await requireAuthenticatedAppUser(
    `/tournaments/${tournamentId}/activate`
  );

  try {
    const result = await activateTournamentEntry({
      appUserId: authContext.appUser.id,
      fantasyTeamId,
      password,
      tournamentId
    });

    revalidatePath("/me");
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}/activate`);
    redirect(
      `/tournaments/${tournamentId}?notice=${encodeURIComponent(
        result.alreadyActivated
          ? `Accesso gia attivo per ${result.teamName}.`
          : `Accesso sbloccato per ${result.teamName}. Ora puoi schierare le formazioni.`
      )}`
    );
  } catch (error) {
    redirect(
      `/tournaments/${tournamentId}/activate?error=${encodeURIComponent(
        getActionErrorMessage(error, "Impossibile sbloccare il torneo.")
      )}`
    );
  }
}

export async function saveTournamentLineupAction(formData: FormData) {
  const rawTeamId = formData.get("teamId");
  const rawFixtureId = formData.get("tournamentFixtureId");
  const teamId = typeof rawTeamId === "string" ? rawTeamId : "";
  const tournamentFixtureId =
    typeof rawFixtureId === "string" ? rawFixtureId : "";

  if (teamId.length === 0 || tournamentFixtureId.length === 0) {
    redirect("/me");
  }

  const authContext = await requireAuthenticatedAppUser(
    `/me/teams/${teamId}/tournaments/fixtures/${tournamentFixtureId}/lineup`
  );

  const selections = [];
  for (const [key, value] of formData.entries()) {
    if (typeof key !== "string" || !key.startsWith("playerSelection:")) {
      continue;
    }

    const playerId = key.slice("playerSelection:".length);
    const selection = parseLineupSelection(value);
    selections.push({
      benchOrder: parseBenchOrder(formData.get(`benchOrder:${playerId}`)),
      playerId,
      selection
    });
  }

  try {
    const result = await saveTournamentLineup({
      appUserId: authContext.appUser.id,
      appUserRole: authContext.appUser.role,
      fantasyTeamId: teamId,
      selections,
      tournamentFixtureId
    });

    revalidatePath("/me");
    revalidatePath(`/tournaments/${result.tournamentId}`);
    revalidatePath(
      `/me/teams/${teamId}/tournaments/fixtures/${tournamentFixtureId}/lineup`
    );
    redirect(
      `/me/teams/${teamId}/tournaments/fixtures/${tournamentFixtureId}/lineup?notice=${encodeURIComponent(
        "Formazione torneo salvata."
      )}`
    );
  } catch (error) {
    redirect(
      `/me/teams/${teamId}/tournaments/fixtures/${tournamentFixtureId}/lineup?error=${encodeURIComponent(
        getActionErrorMessage(
          error,
          "Impossibile salvare la formazione torneo."
        )
      )}`
    );
  }
}
