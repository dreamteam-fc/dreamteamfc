import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";

export type TeamAccessRole = "owner" | "coach" | "admin";

export async function findActiveTeamCoach(
  fantasyTeamId: string,
  userId: string
) {
  return prisma.teamCoach.findFirst({
    where: {
      fantasyTeamId,
      userId,
      revokedAt: null
    },
    select: {
      id: true,
      fantasyTeamId: true,
      userId: true
    }
  });
}

export async function resolveTeamAccessRole(options: {
  appUserId: string;
  appUserRole: UserRole;
  teamOwnerId: string;
  teamId: string;
}): Promise<TeamAccessRole | null> {
  if (options.appUserRole === UserRole.ADMIN) {
    return "admin";
  }

  if (options.appUserId === options.teamOwnerId) {
    return "owner";
  }

  const coach = await findActiveTeamCoach(options.teamId, options.appUserId);
  return coach ? "coach" : null;
}

export function canManageRoster(role: TeamAccessRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canManageLineup(role: TeamAccessRole | null): boolean {
  return role === "owner" || role === "coach" || role === "admin";
}

export function canManageCoachInvites(role: TeamAccessRole | null): boolean {
  return role === "owner";
}

export function canViewTeamAsCoachOrOwner(role: TeamAccessRole | null): boolean {
  return role === "owner" || role === "coach" || role === "admin";
}
