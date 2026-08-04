import { FANTACALCIO_QUOTAZIONI_SOURCE } from "@/lib/server/players/parse-fantacalcio-quotazioni.ts";
import { prisma } from "@/lib/prisma.ts";
import {
  parseFantacalcioVotesBuffer,
  toSavePlayerVoteInput
} from "@/lib/server/votes/parse-fantacalcio-votes-xls.ts";
import {
  assertTournamentVoteLeg,
  generateTournamentRequiredVotes,
  saveTournamentPlayerVote,
  tournamentVoteLegLabel
} from "@/lib/server/tournaments/tournament-votes.ts";

export async function importFantacalcioVotesForTournamentRound(options: {
  buffer: Buffer;
  leg: number;
  roundId: string;
  sheetName?: string;
}) {
  assertTournamentVoteLeg(options.leg);
  await generateTournamentRequiredVotes(options.roundId, options.leg);

  const parsed = parseFantacalcioVotesBuffer(
    options.buffer,
    options.sheetName
  );

  if (parsed.rows.length === 0) {
    throw new Error("Nessuna riga voto valida trovata nel file.");
  }

  const requiredPlayers = await prisma.tournamentRequiredVotePlayer.findMany({
    where: { roundId: options.roundId, leg: options.leg },
    select: {
      playerId: true,
      player: {
        select: {
          externalId: true,
          id: true,
          name: true,
          source: true
        }
      }
    }
  });

  if (requiredPlayers.length === 0) {
    throw new Error(
      `Nessun giocatore in lista voti richiesti per ${tournamentVoteLegLabel(options.leg).toLowerCase()}.`
    );
  }

  const matchedPlayers = await prisma.player.findMany({
    where: {
      externalId: { in: parsed.rows.map((row) => row.externalId) },
      source: FANTACALCIO_QUOTAZIONI_SOURCE
    },
    select: { externalId: true, id: true }
  });

  const playerIdByExternalId = new Map(
    matchedPlayers
      .filter((player) => player.externalId)
      .map((player) => [player.externalId as string, player.id])
  );

  const requiredByPlayerId = new Map(
    requiredPlayers.map((entry) => [entry.playerId, entry])
  );
  const rowsByExternalId = new Map(
    parsed.rows.map((row) => [row.externalId, row])
  );

  let matchedCount = 0;
  let savedCount = 0;
  const skippedUnmatchedCodes: string[] = [];

  for (const row of parsed.rows) {
    const playerId = playerIdByExternalId.get(row.externalId);
    if (!playerId) {
      skippedUnmatchedCodes.push(row.externalId);
      continue;
    }

    if (!requiredByPlayerId.has(playerId)) {
      continue;
    }

    const payload = toSavePlayerVoteInput(row, {
      matchdayId: options.roundId,
      playerId
    });

    matchedCount += 1;
    await saveTournamentPlayerVote({
      assists: payload.assists,
      baseVote: payload.baseVote,
      goals: payload.goals,
      goalsConceded: payload.goalsConceded,
      isSv: payload.isSv,
      leg: options.leg,
      notes: payload.notes,
      ownGoals: payload.ownGoals,
      penaltiesMissed: payload.penaltiesMissed,
      penaltiesSaved: payload.penaltiesSaved,
      penaltiesScored: payload.penaltiesScored,
      playerId,
      redCards: payload.redCards,
      tournamentRoundId: options.roundId,
      yellowCards: payload.yellowCards
    });
    savedCount += 1;
  }

  let missingMarkedSvCount = 0;
  for (const required of requiredPlayers) {
    const externalId = required.player.externalId;
    const presentInFile =
      required.player.source === FANTACALCIO_QUOTAZIONI_SOURCE &&
      externalId != null &&
      rowsByExternalId.has(externalId);

    if (presentInFile) {
      continue;
    }

    await saveTournamentPlayerVote({
      baseVote: null,
      isSv: true,
      leg: options.leg,
      notes: "SV automatico: assente dal file voti",
      playerId: required.playerId,
      tournamentRoundId: options.roundId
    });
    missingMarkedSvCount += 1;
    savedCount += 1;
  }

  return {
    leg: options.leg,
    matchedCount,
    missingMarkedSvCount,
    savedCount,
    sheetName: parsed.sheetName,
    skippedUnmatchedCodes,
    totalRowsInFile: parsed.rows.length
  };
}
