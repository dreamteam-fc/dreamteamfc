import {
  RequiredVoteStatus,
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus,
  VoteStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  calculatePersistedFantavote,
  validatePlayerVoteInput
} from "@/lib/server/votes/shared.ts";

/**
 * Build required vote players for a tournament round.
 *
 * Avoids interactive `$transaction` over Supabase PgBouncer (same durable
 * pattern as league calendar / matchday required-vote generation).
 */
export async function generateTournamentRequiredVotes(roundId: string) {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      lineupsStatus: true,
      fixtures: {
        where: { status: TournamentFixtureStatus.READY },
        select: {
          id: true,
          lineups: {
            select: {
              players: {
                select: { playerId: true }
              }
            }
          }
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  if (round.lineupsStatus !== TournamentRoundLineupsStatus.LOCKED) {
    throw new Error(
      "Genera la lista voti solo dopo aver chiuso le formazioni (LOCKED)."
    );
  }

  const usage = new Map<string, number>();
  for (const fixture of round.fixtures) {
    for (const lineup of fixture.lineups) {
      for (const player of lineup.players) {
        usage.set(player.playerId, (usage.get(player.playerId) ?? 0) + 1);
      }
    }
  }

  if (usage.size === 0) {
    throw new Error(
      "Nessun giocatore in formazione sulle partite READY di questa fase. Schiera prima le formazioni."
    );
  }

  const playerIds = Array.from(usage.keys());
  const [existingVotes, existingRequired] = await Promise.all([
    prisma.tournamentPlayerVote.findMany({
      where: { roundId },
      select: { playerId: true, isSv: true }
    }),
    prisma.tournamentRequiredVotePlayer.findMany({
      where: { roundId },
      select: { playerId: true }
    })
  ]);
  const voteByPlayer = new Map(
    existingVotes.map((vote) => [vote.playerId, vote])
  );
  const existingPlayerIds = new Set(
    existingRequired.map((record) => record.playerId)
  );

  await prisma.tournamentRequiredVotePlayer.deleteMany({
    where: {
      roundId,
      playerId: { notIn: playerIds }
    }
  });

  const createRows: Array<{
    playerId: string;
    roundId: string;
    status: RequiredVoteStatus;
    usageCount: number;
  }> = [];
  const updateGroups = new Map<
    string,
    { playerIds: string[]; status: RequiredVoteStatus; usageCount: number }
  >();

  for (const [playerId, usageCount] of usage.entries()) {
    const vote = voteByPlayer.get(playerId);
    const status = vote
      ? vote.isSv
        ? RequiredVoteStatus.SV
        : RequiredVoteStatus.COMPLETED
      : RequiredVoteStatus.PENDING;

    if (!existingPlayerIds.has(playerId)) {
      createRows.push({ playerId, roundId, status, usageCount });
      continue;
    }

    const key = `${status}:${usageCount}`;
    const group = updateGroups.get(key);
    if (group) {
      group.playerIds.push(playerId);
    } else {
      updateGroups.set(key, {
        playerIds: [playerId],
        status,
        usageCount
      });
    }
  }

  for (let index = 0; index < createRows.length; index += 50) {
    await prisma.tournamentRequiredVotePlayer.createMany({
      data: createRows.slice(index, index + 50),
      skipDuplicates: true
    });
  }

  for (const group of updateGroups.values()) {
    for (let index = 0; index < group.playerIds.length; index += 50) {
      await prisma.tournamentRequiredVotePlayer.updateMany({
        where: {
          roundId,
          playerId: { in: group.playerIds.slice(index, index + 50) }
        },
        data: {
          status: group.status,
          usageCount: group.usageCount
        }
      });
    }
  }

  return {
    playerCount: usage.size,
    roundId,
    roundName: round.name
  };
}

export async function saveTournamentPlayerVote(input: {
  assists?: number;
  baseVote: number | null;
  goals?: number;
  goalsConceded?: number;
  isSv: boolean;
  notes?: string | null;
  ownGoals?: number;
  penaltiesMissed?: number;
  penaltiesSaved?: number;
  penaltiesScored?: number;
  playerId: string;
  redCards?: number;
  tournamentRoundId: string;
  yellowCards?: number;
}) {
  const validated = validatePlayerVoteInput({
    ...input,
    matchdayId: input.tournamentRoundId
  });

  const player = await prisma.player.findUnique({
    where: { id: validated.playerId },
    select: { role: true }
  });

  if (!player) {
    throw new Error("Giocatore non trovato.");
  }

  const isGoalkeeper = player.role === "GOALKEEPER";
  const goalsConceded = isGoalkeeper ? validated.goalsConceded : 0;
  const cleanSheet =
    !validated.isSv && isGoalkeeper && goalsConceded === 0 ? 1 : 0;
  const voteForPersist = {
    ...validated,
    cleanSheet,
    goalsConceded
  };
  const { finalFantavote, requiredVoteStatus } =
    calculatePersistedFantavote(voteForPersist);

  await prisma.$transaction(async (tx) => {
    await tx.tournamentPlayerVote.upsert({
      where: {
        roundId_playerId: {
          playerId: voteForPersist.playerId,
          roundId: input.tournamentRoundId
        }
      },
      create: {
        assists: voteForPersist.assists,
        baseVote: voteForPersist.baseVote,
        cleanSheet: voteForPersist.cleanSheet,
        finalFantavote,
        goals: voteForPersist.goals,
        goalsConceded: voteForPersist.goalsConceded,
        isSv: voteForPersist.isSv,
        notes: voteForPersist.notes,
        ownGoals: voteForPersist.ownGoals,
        penaltiesMissed: voteForPersist.penaltiesMissed,
        penaltiesSaved: voteForPersist.penaltiesSaved,
        penaltiesScored: voteForPersist.penaltiesScored,
        playerId: voteForPersist.playerId,
        redCards: voteForPersist.redCards,
        roundId: input.tournamentRoundId,
        status: VoteStatus.CONFIRMED,
        yellowCards: voteForPersist.yellowCards
      },
      update: {
        assists: voteForPersist.assists,
        baseVote: voteForPersist.baseVote,
        cleanSheet: voteForPersist.cleanSheet,
        finalFantavote,
        goals: voteForPersist.goals,
        goalsConceded: voteForPersist.goalsConceded,
        isSv: voteForPersist.isSv,
        notes: voteForPersist.notes,
        ownGoals: voteForPersist.ownGoals,
        penaltiesMissed: voteForPersist.penaltiesMissed,
        penaltiesSaved: voteForPersist.penaltiesSaved,
        penaltiesScored: voteForPersist.penaltiesScored,
        redCards: voteForPersist.redCards,
        status: VoteStatus.CONFIRMED,
        yellowCards: voteForPersist.yellowCards
      }
    });

    await tx.tournamentRequiredVotePlayer.updateMany({
      where: {
        playerId: voteForPersist.playerId,
        roundId: input.tournamentRoundId
      },
      data: { status: requiredVoteStatus }
    });
  });
}
