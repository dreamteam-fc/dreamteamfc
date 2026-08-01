import { TeamCoachInviteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  createOpaqueToken,
  hashOpaqueToken
} from "@/lib/server/security/invite-token.ts";

const INVITE_TTL_DAYS = 14;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createTeamCoachInvite(options: {
  fantasyTeamId: string;
  invitedById: string;
  inviteeEmail: string;
}) {
  const inviteeEmail = normalizeEmail(options.inviteeEmail);

  if (!inviteeEmail.includes("@") || inviteeEmail.length < 5) {
    throw new Error("Email non valida.");
  }

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: options.fantasyTeamId },
    select: {
      id: true,
      name: true,
      userId: true,
      user: {
        select: {
          email: true
        }
      }
    }
  });

  if (!team) {
    throw new Error("Squadra non trovata.");
  }

  if (team.userId !== options.invitedById) {
    throw new Error("Solo il proprietario puo invitare un allenatore.");
  }

  if (normalizeEmail(team.user.email) === inviteeEmail) {
    throw new Error("Non puoi invitarti come allenatore della tua squadra.");
  }

  const inviteeUser = await prisma.user.findUnique({
    where: { email: inviteeEmail },
    select: { id: true, email: true }
  });

  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const invite = await prisma.$transaction(async (tx) => {
    await tx.teamCoachInvite.updateMany({
      where: {
        fantasyTeamId: team.id,
        status: TeamCoachInviteStatus.PENDING
      },
      data: {
        status: TeamCoachInviteStatus.REVOKED,
        revokedAt: new Date()
      }
    });

    return tx.teamCoachInvite.create({
      data: {
        fantasyTeamId: team.id,
        invitedById: options.invitedById,
        inviteeEmail,
        inviteeUserId: inviteeUser?.id ?? null,
        tokenHash,
        expiresAt,
        status: TeamCoachInviteStatus.PENDING
      },
      select: {
        id: true,
        expiresAt: true,
        inviteeEmail: true
      }
    });
  });

  return {
    ...invite,
    teamName: team.name,
    token
  };
}

export async function revokeTeamCoachInvite(options: {
  inviteId: string;
  ownerUserId: string;
}) {
  const invite = await prisma.teamCoachInvite.findUnique({
    where: { id: options.inviteId },
    select: {
      id: true,
      status: true,
      fantasyTeam: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!invite || invite.fantasyTeam.userId !== options.ownerUserId) {
    throw new Error("Invito non trovato.");
  }

  if (invite.status !== TeamCoachInviteStatus.PENDING) {
    throw new Error("L'invito non e piu pendente.");
  }

  await prisma.teamCoachInvite.update({
    where: { id: invite.id },
    data: {
      status: TeamCoachInviteStatus.REVOKED,
      revokedAt: new Date()
    }
  });
}

export async function revokeActiveTeamCoach(options: {
  fantasyTeamId: string;
  ownerUserId: string;
}) {
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: options.fantasyTeamId },
    select: { id: true, userId: true }
  });

  if (!team || team.userId !== options.ownerUserId) {
    throw new Error("Squadra non trovata.");
  }

  await prisma.teamCoach.updateMany({
    where: {
      fantasyTeamId: team.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function getTeamCoachInviteByToken(token: string) {
  const tokenHash = hashOpaqueToken(token);
  return prisma.teamCoachInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      inviteeEmail: true,
      invitedBy: {
        select: {
          displayName: true,
          email: true
        }
      },
      fantasyTeam: {
        select: {
          id: true,
          name: true,
          league: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });
}

export async function acceptTeamCoachInvite(options: {
  token: string;
  appUserId: string;
  appUserEmail: string;
}) {
  const tokenHash = hashOpaqueToken(options.token);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const invite = await tx.teamCoachInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        inviteeEmail: true,
        invitedById: true,
        fantasyTeamId: true,
        fantasyTeam: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    });

    if (!invite) {
      throw new Error("Invito non valido.");
    }

    if (invite.status === TeamCoachInviteStatus.REVOKED) {
      throw new Error("Invito revocato.");
    }

    if (invite.status === TeamCoachInviteStatus.ACCEPTED) {
      throw new Error("Invito gia accettato.");
    }

    if (invite.expiresAt.getTime() < now.getTime()) {
      await tx.teamCoachInvite.update({
        where: { id: invite.id },
        data: { status: TeamCoachInviteStatus.EXPIRED }
      });
      throw new Error("Invito scaduto.");
    }

    if (normalizeEmail(options.appUserEmail) !== normalizeEmail(invite.inviteeEmail)) {
      throw new Error(
        "Devi accedere con l'email a cui e stato inviato l'invito."
      );
    }

    if (options.appUserId === invite.fantasyTeam.userId) {
      throw new Error("Il proprietario non puo essere allenatore della stessa squadra.");
    }

    await tx.teamCoach.updateMany({
      where: {
        fantasyTeamId: invite.fantasyTeamId,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    const existing = await tx.teamCoach.findUnique({
      where: {
        fantasyTeamId_userId: {
          fantasyTeamId: invite.fantasyTeamId,
          userId: options.appUserId
        }
      },
      select: { id: true }
    });

    if (existing) {
      await tx.teamCoach.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          inviteId: invite.id,
          invitedById: invite.invitedById
        }
      });
    } else {
      await tx.teamCoach.create({
        data: {
          fantasyTeamId: invite.fantasyTeamId,
          userId: options.appUserId,
          invitedById: invite.invitedById,
          inviteId: invite.id
        }
      });
    }

    await tx.teamCoachInvite.update({
      where: { id: invite.id },
      data: {
        status: TeamCoachInviteStatus.ACCEPTED,
        acceptedAt: now,
        inviteeUserId: options.appUserId
      }
    });

    return {
      teamId: invite.fantasyTeam.id,
      teamName: invite.fantasyTeam.name
    };
  });
}

export async function listTeamCoachManagement(fantasyTeamId: string) {
  const [pendingInvites, activeCoaches] = await Promise.all([
    prisma.teamCoachInvite.findMany({
      where: {
        fantasyTeamId,
        status: TeamCoachInviteStatus.PENDING,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inviteeEmail: true,
        expiresAt: true,
        createdAt: true
      }
    }),
    prisma.teamCoach.findMany({
      where: {
        fantasyTeamId,
        revokedAt: null
      },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      }
    })
  ]);

  return { activeCoaches, pendingInvites };
}
