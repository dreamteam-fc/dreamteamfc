"use server";

import { MatchdayStatus, RequiredVoteStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assertCanAssignAppRoles,
  assertCanManageLeagueOps,
  assertCanManageVotes,
  requireAdminAccess
} from "@/lib/auth/admin.ts";
import { parseAppRole } from "@/lib/auth/app-roles.ts";
import { prisma } from "@/lib/prisma.ts";
import { calculateFantavote } from "@/lib/scoring/calculate-fantavote.ts";
import { fileToOwnedBuffer } from "@/lib/server/http/owned-buffer.ts";
import { createLeague } from "@/lib/server/admin/create-league.ts";
import { resetLeagueData } from "@/lib/server/admin/reset-league-data.ts";
import { createTournament } from "@/lib/server/tournaments/create-tournament.ts";
import { generateTournamentBracket } from "@/lib/server/tournaments/generate-tournament-bracket.ts";
import { calculateTournamentRoundResultsFromVotes } from "@/lib/server/tournaments/calculate-tournament-round-results.ts";
import { importFantacalcioVotesForTournamentRound } from "@/lib/server/tournaments/import-tournament-votes.ts";
import { lockTournamentRoundLineups } from "@/lib/server/tournaments/lock-tournament-round-lineups.ts";
import { openTournamentRoundLineups } from "@/lib/server/tournaments/open-tournament-round-lineups.ts";
import {
  formatGenerateRandomTournamentLineupsNotice,
  generateRandomTournamentLineupsForRound
} from "@/lib/server/tournaments/generate-random-tournament-lineups-for-round.ts";
import {
  generateTournamentRequiredVotes,
  tournamentVoteLegLabel
} from "@/lib/server/tournaments/tournament-votes.ts";
import { autoResolveCompletedSeriesWinners } from "@/lib/server/tournaments/auto-resolve-series-winners.ts";
import { listPendingTournamentSeriesTies } from "@/lib/server/tournaments/pending-series-ties.ts";
import { pickTournamentSeriesWinner } from "@/lib/server/tournaments/pick-tournament-series-winner.ts";
import { recordTournamentFixtureResult } from "@/lib/server/tournaments/record-tournament-result.ts";
import { saveTournamentEntries } from "@/lib/server/tournaments/tournament-entries.ts";
import {
  blockPlayerInLeague,
  unblockPlayerInLeague
} from "@/lib/server/players/league-blocked-players.ts";
import {
  formatGenerateAllLeagueSchedulesNotice,
  generateAllLeagueSchedules
} from "@/lib/server/schedules/generate-all-league-schedules.ts";
import { generateLeagueSchedule } from "@/lib/server/schedules/generate-league-schedule.ts";
import { calculateFantasyFixtureResults } from "@/lib/server/fixtures/calculate-fantasy-fixture-results.ts";
import { generateFantasyFixtures } from "@/lib/server/fixtures/generate-fantasy-fixtures.ts";
import { checkVotesCompletion } from "@/lib/server/matchdays/check-votes-completion.ts";
import { generateRequiredVotePlayers } from "@/lib/server/matchdays/generate-required-vote-players.ts";
import {
  formatPublishAllMatchdaysNotice,
  publishAllMatchdays
} from "@/lib/server/matchdays/publish-all-matchdays.ts";
import { publishMatchday } from "@/lib/server/matchdays/publish-matchday.ts";
import {
  calculateAllScoresAndResults,
  formatCalculateAllScoresAndResultsNotice
} from "@/lib/server/scores/calculate-all-scores-and-results.ts";
import { calculateMatchdayScores } from "@/lib/server/scores/calculate-matchday-scores.ts";
import { savePlayerVote } from "@/lib/server/votes/save-player-vote.ts";
import {
  formatImportFantacalcioVotesAcrossMatchdaysNotice,
  importFantacalcioVotesAcrossMatchdays,
  importFantacalcioVotesFromBuffer
} from "@/lib/server/votes/import-fantacalcio-votes.ts";
import {
  adminAddPlayerToRoster,
  adminRemovePlayerFromRoster,
  adminReplacePlayerInRoster
} from "@/lib/server/rosters/admin-roster-mutations.ts";
import {
  formatGenerateAllRandomLineupsNotice,
  generateAllRandomLineups
} from "@/lib/server/lineups/generate-all-random-lineups.ts";
import { generateRandomLineupsForMatchday } from "@/lib/server/lineups/generate-random-lineups-for-matchday.ts";
import {
  formatLockAllLineupsNotice,
  lockAllLineups
} from "@/lib/server/lineups/lock-all-lineups.ts";
import { lockMatchdayLineups } from "@/lib/server/lineups/lock-matchday-lineups.ts";
import {
  formatOpenAllLineupsNotice,
  openAllLineups
} from "@/lib/server/lineups/open-all-lineups.ts";
import { openMatchdayLineups } from "@/lib/server/lineups/open-matchday-lineups.ts";

const VOTE_FIELD_NAMES = [
  "assists",
  "baseVote",
  "cleanSheet",
  "goals",
  "goalsConceded",
  "notes",
  "ownGoals",
  "penaltiesMissed",
  "penaltiesSaved",
  "penaltiesScored",
  "redCards",
  "yellowCards"
] as const;

type VoteFieldName = (typeof VOTE_FIELD_NAMES)[number];
type DemoVote = {
  assists: number;
  baseVote: number | null;
  cleanSheet: number;
  goals: number;
  isSv: boolean;
  notes: string;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  redCards: number;
  usedFallback: boolean;
  yellowCards: number;
};

function redirectWithMessage(
  redirectPath: string,
  options: { error?: string; notice?: string }
): never {
  const url = new URL(`http://localhost${redirectPath}`);

  if (options.notice) {
    url.searchParams.set("notice", options.notice);
  }

  if (options.error) {
    url.searchParams.set("error", options.error);
  }

  redirect(`${url.pathname}${url.search}`);
}

/** Platform God mode only. */
async function assertAdminAction() {
  await requireAdminAccess();
}

async function assertVotesAction() {
  await assertCanManageVotes();
}

async function assertLeagueOpsAction() {
  await assertCanManageLeagueOps();
}

function revalidateAdminPaths(matchdayId: string, leagueId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/votes");
  revalidatePath(`/admin/matchdays/${matchdayId}`);
  revalidatePath(`/admin/matchdays/${matchdayId}/votes`);
  revalidatePath(`/admin/matchdays/${matchdayId}/scores`);
  if (leagueId) {
    revalidatePath(`/admin/leagues/${leagueId}/standings`);
    revalidatePath(`/admin/leagues/${leagueId}/matchdays/new`);
    revalidatePath(`/admin/leagues/${leagueId}/teams`);
  }
}

function readPlayerMatchdayIds(formData: FormData, playerId: string) {
  return Array.from(
    new Set(
      formData
        .getAll(`playerMatchdayIds.${playerId}`)
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
}

async function saveVoteAcrossMatchdays(
  formData: FormData,
  playerId: string,
  matchdayIds: string[]
) {
  if (matchdayIds.length === 0) {
    throw new Error("Nessuna giornata collegata al giocatore.");
  }

  const template = buildBulkVoteInput(formData, matchdayIds[0], playerId);

  if (template.kind === "skip") {
    return { kind: "skip" as const };
  }

  if (template.kind === "invalid") {
    return template;
  }

  for (const matchdayId of matchdayIds) {
    await savePlayerVote({
      ...template.input,
      matchdayId
    });
  }

  return {
    kind: "save" as const,
    matchdayCount: matchdayIds.length,
    playerId
  };
}

async function loadMatchdaysForUnifiedNumber(matchdayNumber: number) {
  return prisma.matchday.findMany({
    where: {
      number: matchdayNumber,
      status: {
        in: [
          MatchdayStatus.LINEUPS_LOCKED,
          MatchdayStatus.VOTES_PENDING,
          MatchdayStatus.VOTES_COMPLETED,
          MatchdayStatus.SCORES_CALCULATED
        ]
      }
    },
    select: {
      id: true,
      leagueId: true,
      number: true,
      league: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { leagueId: "asc" }
  });
}

function revalidateLeaguePaths(leagueId: string) {
  revalidatePath("/admin");
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/standings`);
  revalidatePath(`/admin/leagues/${leagueId}/matchdays/new`);
}

async function revalidateGlobalPlayerAvailabilityPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath("/me");
  revalidatePath("/leagues");

  const [leagues, teams, openMatchdays] = await Promise.all([
    prisma.league.findMany({
      select: {
        id: true
      }
    }),
    prisma.fantasyTeam.findMany({
      select: {
        id: true
      }
    }),
    prisma.matchday.findMany({
      where: {
        status: MatchdayStatus.LINEUPS_OPEN
      },
      select: {
        id: true
      }
    })
  ]);

  for (const league of leagues) {
    revalidatePath(`/leagues/${league.id}`);
    revalidatePath(`/admin/leagues/${league.id}/players`);
  }

  for (const team of teams) {
    revalidatePath(`/me/teams/${team.id}`);
    revalidatePath(`/me/teams/${team.id}/roster`);

    for (const matchday of openMatchdays) {
      revalidatePath(`/me/teams/${team.id}/matchdays/${matchday.id}/lineup`);
    }
  }
}

async function revalidateLeaguePlayerAvailabilityPaths(leagueId: string) {
  revalidatePath("/admin");
  revalidatePath("/me");
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/admin/leagues/${leagueId}/players`);

  const [teams, openMatchdays] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: {
        leagueId
      },
      select: {
        id: true
      }
    }),
    prisma.matchday.findMany({
      where: {
        leagueId,
        status: MatchdayStatus.LINEUPS_OPEN
      },
      select: {
        id: true
      }
    })
  ]);

  for (const team of teams) {
    revalidatePath(`/me/teams/${team.id}`);
    revalidatePath(`/me/teams/${team.id}/roster`);

    for (const matchday of openMatchdays) {
      revalidatePath(`/me/teams/${team.id}/matchdays/${matchday.id}/lineup`);
    }
  }
}

function buildAdminNewMatchdayPath(leagueId: string) {
  return `/admin/leagues/${leagueId}/matchdays/new`;
}

function buildAdminLeagueSchedulePath(leagueId: string) {
  return `/admin/leagues/${leagueId}/schedule`;
}

function buildAdminMatchdayPath(matchdayId: string) {
  return `/admin/matchdays/${matchdayId}`;
}

function readRequiredString(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}.`);
  }

  return value;
}

function readOptionalNumber(
  formData: FormData,
  fieldName: string
): number | null {
  const value = formData.get(fieldName);
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${fieldName}.`);
  }

  return parsed;
}

function readCounter(formData: FormData, fieldName: string): number {
  return readOptionalNumber(formData, fieldName) ?? 0;
}

function readOptionalString(formData: FormData, fieldName: string): string | null {
  const value = formData.get(fieldName);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value;
}

function readTournamentVoteLeg(formData: FormData): 1 | 2 {
  const parsed = readOptionalNumber(formData, "leg");
  if (parsed !== 1 && parsed !== 2) {
    throw new Error("Gamba non valida: usa 1 (andata) o 2 (ritorno).");
  }
  return parsed;
}

function getVoteFieldName(playerId: string, fieldName: VoteFieldName) {
  return `votes.${playerId}.${fieldName}`;
}

function readVoteOptionalNumber(
  formData: FormData,
  playerId: string,
  fieldName: Exclude<VoteFieldName, "notes">
) {
  return readOptionalNumber(formData, getVoteFieldName(playerId, fieldName));
}

function readVoteCounter(
  formData: FormData,
  playerId: string,
  fieldName: Exclude<VoteFieldName, "baseVote" | "notes">
) {
  return readVoteOptionalNumber(formData, playerId, fieldName) ?? 0;
}

function readVoteOptionalString(formData: FormData, playerId: string, fieldName: "notes") {
  return readOptionalString(formData, getVoteFieldName(playerId, fieldName));
}

function readVoteIsSv(formData: FormData, playerId: string) {
  return formData.get(`votes.${playerId}.isSv`) === "on";
}

function readVotePlayerLabel(formData: FormData, playerId: string) {
  return readOptionalString(formData, `playerLabels.${playerId}`) ?? playerId;
}

function randomChoice<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomFromThresholds<T>(options: Array<{ max: number; value: T }>): T {
  const roll = Math.random();
  const match = options.find((option) => roll <= option.max);
  return match ? match.value : options[options.length - 1].value;
}

function generateFallbackDemoVote(): DemoVote {
  return {
    assists: 0,
    baseVote: 6,
    cleanSheet: 0,
    goals: 0,
    isSv: false,
    notes: "Voto demo generato per test",
    ownGoals: 0,
    penaltiesMissed: 0,
    penaltiesSaved: 0,
    redCards: 0,
    usedFallback: true,
    yellowCards: 0
  };
}

function buildRandomDemoVoteCandidate(): Omit<DemoVote, "usedFallback"> {
  const isSv = Math.random() < 0.1;

  if (isSv) {
    return {
      assists: 0,
      baseVote: null,
      cleanSheet: 0,
      goals: 0,
      isSv: true,
      notes: "Voto demo generato per test",
      ownGoals: 0,
      penaltiesMissed: 0,
      penaltiesSaved: 0,
      redCards: 0,
      yellowCards: 0
    };
  }

  const goals = randomFromThresholds<number>([
    { max: 0.76, value: 0 },
    { max: 0.95, value: 1 },
    { max: 1, value: 2 }
  ]);
  const assists = randomFromThresholds<number>([
    { max: 0.74, value: 0 },
    { max: 0.95, value: 1 },
    { max: 1, value: 2 }
  ]);
  const yellowCards = Math.random() < 0.2 ? 1 : 0;
  const redCards = Math.random() < 0.05 ? 1 : 0;
  const ownGoals = Math.random() < 0.04 ? 1 : 0;
  const penaltiesMissed = Math.random() < 0.04 ? 1 : 0;
  const penaltiesSaved = Math.random() < 0.03 ? 1 : 0;
  const cleanSheet = Math.random() < 0.18 ? 1 : 0;

  let baseVoteOptions = [5, 5.5, 6, 6.5, 7, 7.5, 8];

  if (redCards === 1) {
    baseVoteOptions = baseVoteOptions.filter((value) => value <= 6.5);
  }

  if (goals >= 2) {
    baseVoteOptions = baseVoteOptions.filter((value) => value >= 6.5);
  }

  if (baseVoteOptions.length === 0) {
    baseVoteOptions = [6];
  }

  return {
    assists,
    baseVote: randomChoice(baseVoteOptions),
    cleanSheet,
    goals,
    isSv: false,
    notes: "Voto demo generato per test",
    ownGoals,
    penaltiesMissed,
    penaltiesSaved,
    redCards,
    yellowCards
  };
}

function generateCoherentDemoVote(): DemoVote {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = buildRandomDemoVoteCandidate();

    if (candidate.isSv) {
      return {
        ...candidate,
        usedFallback: false
      };
    }

    const calculation = calculateFantavote(candidate);
    if (
      calculation.finalFantavote !== null &&
      calculation.finalFantavote >= 0 &&
      calculation.finalFantavote <= 10
    ) {
      return {
        ...candidate,
        usedFallback: false
      };
    }
  }

  return generateFallbackDemoVote();
}

function buildBulkVoteInput(formData: FormData, matchdayId: string, playerId: string) {
  const isSv = readVoteIsSv(formData, playerId);
  const baseVote = isSv
    ? null
    : readVoteOptionalNumber(formData, playerId, "baseVote");
  const notes = readVoteOptionalString(formData, playerId, "notes");
  const assists = readVoteCounter(formData, playerId, "assists");
  const cleanSheet = readVoteCounter(formData, playerId, "cleanSheet");
  const goals = readVoteCounter(formData, playerId, "goals");
  const goalsConceded = readVoteCounter(formData, playerId, "goalsConceded");
  const ownGoals = readVoteCounter(formData, playerId, "ownGoals");
  const penaltiesMissed = readVoteCounter(formData, playerId, "penaltiesMissed");
  const penaltiesSaved = readVoteCounter(formData, playerId, "penaltiesSaved");
  const penaltiesScored = readVoteCounter(formData, playerId, "penaltiesScored");
  const redCards = readVoteCounter(formData, playerId, "redCards");
  const yellowCards = readVoteCounter(formData, playerId, "yellowCards");

  const hasEventCounters =
    assists > 0 ||
    cleanSheet > 0 ||
    goals > 0 ||
    goalsConceded > 0 ||
    ownGoals > 0 ||
    penaltiesMissed > 0 ||
    penaltiesSaved > 0 ||
    penaltiesScored > 0 ||
    redCards > 0 ||
    yellowCards > 0;
  const isTouched =
    isSv || baseVote !== null || hasEventCounters || Boolean(notes);

  if (!isTouched) {
    return {
      kind: "skip" as const
    };
  }

  if (!isSv && baseVote === null) {
    return {
      kind: "invalid" as const,
      reason: "base vote obbligatorio"
    };
  }

  return {
    kind: "save" as const,
    input: {
      assists,
      baseVote,
      cleanSheet,
      goals,
      goalsConceded,
      isSv,
      matchdayId,
      notes,
      ownGoals,
      penaltiesMissed,
      penaltiesSaved,
      penaltiesScored,
      playerId,
      redCards,
      yellowCards
    }
  };
}

export async function generateRequiredVotePlayersAction(formData: FormData) {
  await assertVotesAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await generateRequiredVotePlayers(matchdayId);
    await checkVotesCompletion(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Giocatori utili aggiornati: ${result.totalRequired}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Operazione non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function createLeagueAction(formData: FormData) {
  const authContext = await requireAdminAccess();
  const rawName = formData.get("name");
  const rawPassword = formData.get("password");

  const name = typeof rawName === "string" ? rawName : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  try {
    const result = await createLeague({
      createdById: authContext.appUser.id,
      name,
      password
    });

    revalidateLeaguePaths(result.leagueId);

    redirectWithMessage("/admin", {
      notice: `Lega creata: ${result.name}. Max squadre: ${result.maxTeams} (andata/ritorno = 18 giornate).`
    });
  } catch (error) {
    redirectWithMessage("/admin/leagues/new", {
      error:
        error instanceof Error
          ? error.message
          : "Creazione lega non riuscita."
    });
  }
}

export async function createTournamentAction(formData: FormData) {
  const authContext = await requireAdminAccess();
  const rawName = formData.get("name");
  const rawPassword = formData.get("password");

  const name = typeof rawName === "string" ? rawName : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  try {
    const result = await createTournament({
      createdById: authContext.appUser.id,
      name,
      password
    });

    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    redirectWithMessage(`/admin/tournaments/${result.tournamentId}/entries`, {
      notice: `Torneo creato: ${result.name}. Seleziona le squadre.`
    });
  } catch (error) {
    redirectWithMessage("/admin/tournaments/new", {
      error:
        error instanceof Error
          ? error.message
          : "Creazione torneo non riuscita."
    });
  }
}

export async function saveTournamentEntriesAction(formData: FormData) {
  await assertAdminAction();
  const rawTournamentId = formData.get("tournamentId");
  const tournamentId =
    typeof rawTournamentId === "string" ? rawTournamentId : "";
  const fantasyTeamIds = formData
    .getAll("fantasyTeamId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (tournamentId.length === 0) {
    redirectWithMessage("/admin/tournaments", {
      error: "Torneo non valido."
    });
  }

  try {
    const result = await saveTournamentEntries({
      fantasyTeamIds,
      tournamentId
    });

    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}/entries`);
    redirectWithMessage(`/admin/tournaments/${tournamentId}/entries`, {
      notice: `Roster salvato: ${result.count} squadre in ${result.name}. Prossimo passo: generazione tabellone.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/entries`, {
      error:
        error instanceof Error
          ? error.message
          : "Salvataggio squadre torneo non riuscito."
    });
  }
}

export async function generateTournamentBracketAction(formData: FormData) {
  await assertAdminAction();
  const rawTournamentId = formData.get("tournamentId");
  const tournamentId =
    typeof rawTournamentId === "string" ? rawTournamentId : "";

  if (tournamentId.length === 0) {
    redirectWithMessage("/admin/tournaments", {
      error: "Torneo non valido."
    });
  }

  try {
    const result = await generateTournamentBracket(tournamentId);
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}/entries`);
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: `Tabellone generato per ${result.name}: ${result.rounds} fasi, ${result.pairs} serie in 1ª fase.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/entries`, {
      error:
        error instanceof Error
          ? error.message
          : "Generazione tabellone non riuscita."
    });
  }
}

export async function recordTournamentFixtureResultAction(formData: FormData) {
  await assertAdminAction();
  const rawFixtureId = formData.get("fixtureId");
  const rawTournamentId = formData.get("tournamentId");
  const fixtureId = typeof rawFixtureId === "string" ? rawFixtureId : "";
  const tournamentId =
    typeof rawTournamentId === "string" ? rawTournamentId : "";

  if (fixtureId.length === 0 || tournamentId.length === 0) {
    redirectWithMessage("/admin/tournaments", {
      error: "Partita non valida."
    });
  }

  try {
    const result = await recordTournamentFixtureResult({
      awayFantapunti: formData.get("awayFantapunti"),
      awayGoals: formData.get("awayGoals"),
      fixtureId,
      homeFantapunti: formData.get("homeFantapunti"),
      homeGoals: formData.get("homeGoals")
    });
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    const notice =
      result.seriesOutcome === "tied"
        ? "Risultato salvato. Serie in parità: seleziona manualmente il vincitore prima di aprire la prossima giornata."
        : result.seriesOutcome === "advanced" ||
            result.seriesOutcome === "final_done"
          ? "Risultato salvato. Vincitore serie determinato e aggiornato nel tabellone."
          : "Risultato salvato.";
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Salvataggio risultato non riuscito."
    });
  }
}

export async function pickTournamentSeriesWinnerAction(formData: FormData) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const seriesKey = readRequiredString(formData, "seriesKey");
  const winnerTeamId = readRequiredString(formData, "winnerTeamId");

  try {
    const result = await pickTournamentSeriesWinner({
      seriesKey,
      tournamentId,
      winnerTeamId
    });
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    revalidatePath(`/tournaments/${tournamentId}`);
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: result.advanced
        ? `Vincitore serie selezionato in ${result.roundName}: avanza alla fase successiva.`
        : `Vincitore della finale selezionato in ${result.roundName}. Torneo completato.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Selezione vincitore serie non riuscita."
    });
  }
}

export async function openTournamentRoundLineupsAction(formData: FormData) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readRequiredString(formData, "roundId");
  const leg = readTournamentVoteLeg(formData);

  try {
    const result = await openTournamentRoundLineups(roundId, leg);
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath("/me");
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: `Formazioni aperte per ${result.giornataLabel}.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Impossibile aprire le formazioni della giornata."
    });
  }
}

export async function lockTournamentRoundLineupsAction(formData: FormData) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readRequiredString(formData, "roundId");
  const leg = readTournamentVoteLeg(formData);

  try {
    const result = await lockTournamentRoundLineups(roundId, leg);
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath("/me");
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: `Formazioni chiuse per ${result.giornataLabel}. Puoi generare la lista voti.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Impossibile chiudere le formazioni della giornata."
    });
  }
}

export async function generateRandomTournamentLineupsForRoundAction(
  formData: FormData
) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readOptionalString(formData, "roundId");
  const legRaw = readOptionalNumber(formData, "leg");
  const redirectPath =
    readOptionalString(formData, "redirectPath") ??
    `/admin/tournaments/${tournamentId}/bracket`;
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await generateRandomTournamentLineupsForRound({
      force: true,
      tournamentId,
      ...(roundId ? { roundId } : {}),
      ...(legRaw === 1 || legRaw === 2 ? { leg: legRaw } : {})
    });

    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath("/me");

    const teamIds = await prisma.tournamentLineup.findMany({
      where: {
        tournamentFixture: {
          roundId: result.roundId
        }
      },
      select: { fantasyTeamId: true },
      distinct: ["fantasyTeamId"]
    });
    for (const row of teamIds) {
      revalidatePath(`/me/teams/${row.fantasyTeamId}`);
    }

    if (result.written === 0 && result.failures.length > 0) {
      const preview = result.failures
        .slice(0, 3)
        .map((failure) => `${failure.teamName}: ${failure.error}`)
        .join(" | ");
      throw new Error(
        `Nessuna formazione generata. ${preview}${result.failures.length > 3 ? "…" : ""}`
      );
    }

    notice = formatGenerateRandomTournamentLineupsNotice(result);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Generazione formazioni torneo non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function importTournamentRoundVotesAction(formData: FormData) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readRequiredString(formData, "roundId");
  const sheetNameRaw = readOptionalString(formData, "sheetName");
  const fileValue = formData.get("votesFile");
  const redirectPath = `/admin/tournaments/${tournamentId}/bracket`;

  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const leg = readTournamentVoteLeg(formData);
    if (!(fileValue instanceof File) || fileValue.size === 0) {
      throw new Error("Seleziona un file XLS/XLSX dei voti Fantacalcio.");
    }

    const fileName = fileValue.name.toLowerCase();
    if (!fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      throw new Error("Formato non supportato. Carica un file .xls o .xlsx.");
    }

    const buffer = await fileToOwnedBuffer(fileValue);
    const result = await importFantacalcioVotesForTournamentRound({
      buffer,
      leg,
      roundId,
      sheetName: sheetNameRaw || undefined
    });

    revalidatePath(redirectPath);
    const unmatchedPreview =
      result.skippedUnmatchedCodes.length > 0
        ? ` Codici non in DB: ${result.skippedUnmatchedCodes.slice(0, 8).join(", ")}${result.skippedUnmatchedCodes.length > 8 ? "…" : ""}.`
        : "";
    const legLabel = tournamentVoteLegLabel(result.leg);

    notice = `Import voti ${legLabel} (${result.sheetName}): ${result.savedCount} salvati, ${result.matchedCount} dal file, ${result.missingMarkedSvCount} SV assenti.${unmatchedPreview}`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Import voti torneo non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function calculateTournamentRoundFromVotesAction(
  formData: FormData
) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readRequiredString(formData, "roundId");

  try {
    const leg = readTournamentVoteLeg(formData);
    const result = await calculateTournamentRoundResultsFromVotes(roundId, leg);
    const auto = await autoResolveCompletedSeriesWinners(tournamentId);
    const pending = await listPendingTournamentSeriesTies(tournamentId);
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    revalidatePath(`/tournaments/${tournamentId}`);
    const tieNotice =
      pending.length > 0
        ? ` Attenzione: ${pending.length} serie in parità senza vincitore — selezionale prima di aprire la prossima giornata.`
        : auto.advanced > 0
          ? ` Avanzate automaticamente ${auto.advanced} serie.`
          : "";
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: `Calcolate ${result.calculatedCount} partite READY (${tournamentVoteLegLabel(result.leg)}) in ${result.roundName} da fantavoto.${tieNotice}`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Calcolo risultati torneo non riuscito."
    });
  }
}

export async function generateTournamentRoundRequiredVotesAction(
  formData: FormData
) {
  await assertAdminAction();
  const tournamentId = readRequiredString(formData, "tournamentId");
  const roundId = readRequiredString(formData, "roundId");

  try {
    const leg = readTournamentVoteLeg(formData);
    const result = await generateTournamentRequiredVotes(roundId, leg);
    revalidatePath(`/admin/tournaments/${tournamentId}/bracket`);
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      notice: `Lista voti ${tournamentVoteLegLabel(result.leg)} generata per ${result.roundName}: ${result.playerCount} giocatori.`
    });
  } catch (error) {
    redirectWithMessage(`/admin/tournaments/${tournamentId}/bracket`, {
      error:
        error instanceof Error
          ? error.message
          : "Generazione lista voti torneo non riuscita."
    });
  }
}

export async function blockPlayerInLeagueAction(formData: FormData) {
  await assertAdminAction();
  const leagueId = readRequiredString(formData, "leagueId");
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  const reason = readOptionalString(formData, "reason");

  try {
    await blockPlayerInLeague(leagueId, playerId, reason);
    await revalidateLeaguePlayerAvailabilityPaths(leagueId);

    redirectWithMessage(redirectPath, {
      notice: "Giocatore bloccato nella lega."
    });
  } catch (error) {
    redirectWithMessage(redirectPath, {
      error:
        error instanceof Error ? error.message : "Blocco giocatore non riuscito."
    });
  }
}

export async function unblockPlayerInLeagueAction(formData: FormData) {
  await assertAdminAction();
  const leagueId = readRequiredString(formData, "leagueId");
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");

  try {
    await unblockPlayerInLeague(leagueId, playerId);
    await revalidateLeaguePlayerAvailabilityPaths(leagueId);

    redirectWithMessage(redirectPath, {
      notice: "Giocatore sbloccato nella lega."
    });
  } catch (error) {
    redirectWithMessage(redirectPath, {
      error:
        error instanceof Error
          ? error.message
          : "Sblocco giocatore non riuscito."
    });
  }
}

export async function deactivatePlayerGloballyAction(formData: FormData) {
  await assertAdminAction();
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");

  try {
    await prisma.player.update({
      where: {
        id: playerId
      },
      data: {
        isActive: false
      }
    });

    await revalidateGlobalPlayerAvailabilityPaths();

    redirectWithMessage(redirectPath, {
      notice: "Giocatore disattivato globalmente."
    });
  } catch (error) {
    redirectWithMessage(redirectPath, {
      error:
        error instanceof Error
          ? error.message
          : "Disattivazione giocatore non riuscita."
    });
  }
}

export async function reactivatePlayerGloballyAction(formData: FormData) {
  await assertAdminAction();
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");

  try {
    await prisma.player.update({
      where: {
        id: playerId
      },
      data: {
        isActive: true
      }
    });

    await revalidateGlobalPlayerAvailabilityPaths();

    redirectWithMessage(redirectPath, {
      notice: "Giocatore riattivato globalmente."
    });
  } catch (error) {
    redirectWithMessage(redirectPath, {
      error:
        error instanceof Error
          ? error.message
          : "Riattivazione giocatore non riuscita."
    });
  }
}

export async function createMatchdayAction(formData: FormData) {
  await assertLeagueOpsAction();
  const leagueId = readRequiredString(formData, "leagueId");
  const rawNumber = formData.get("number");
  const number =
    typeof rawNumber === "string" && rawNumber.trim().length > 0
      ? Number(rawNumber)
      : Number.NaN;

  try {
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error("Il numero giornata deve essere un intero positivo.");
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId
      },
      select: {
        id: true
      }
    });

    if (!league) {
      throw new Error("Lega non trovata.");
    }

    const existingMatchday = await prisma.matchday.findUnique({
      where: {
        leagueId_number: {
          leagueId,
          number
        }
      },
      select: {
        id: true
      }
    });

    if (existingMatchday) {
      throw new Error("Esiste gia una giornata con questo numero nella lega.");
    }

    const matchday = await prisma.matchday.create({
      data: {
        leagueId,
        number,
        status: MatchdayStatus.DRAFT
      },
      select: {
        id: true
      }
    });

    revalidateLeaguePaths(leagueId);
    redirectWithMessage(buildAdminMatchdayPath(matchday.id), {
      notice: `Giornata ${number} creata in stato DRAFT.`
    });
  } catch (error) {
    redirectWithMessage(buildAdminNewMatchdayPath(leagueId), {
      error:
        error instanceof Error
          ? error.message
          : "Creazione giornata non riuscita."
    });
  }
}

export async function generateLeagueScheduleAction(formData: FormData) {
  await assertLeagueOpsAction();
  const leagueId = readRequiredString(formData, "leagueId");

  try {
    const result = await generateLeagueSchedule({
      leagueId,
      mode: "DOUBLE_ROUND"
    });

    revalidateLeaguePaths(leagueId);
    revalidatePath(buildAdminLeagueSchedulePath(leagueId));

    redirectWithMessage(buildAdminLeagueSchedulePath(leagueId), {
      notice: `Calendario andata/ritorno generato. Giornate: ${result.matchdayCount}. Partite: ${result.fixtureCount}. Turni di riposo: ${result.byeCount}.`
    });
  } catch (error) {
    redirectWithMessage(buildAdminLeagueSchedulePath(leagueId), {
      error:
        error instanceof Error
          ? error.message
          : "Generazione calendario non riuscita."
    });
  }
}

export async function generateAllLeagueSchedulesAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  const force = formData.get("force") === "true";
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const summary = await generateAllLeagueSchedules({ force });

    revalidatePath("/admin");
    revalidatePath("/admin/lineups");
    for (const item of summary.generated) {
      revalidateLeaguePaths(item.leagueId);
      revalidatePath(buildAdminLeagueSchedulePath(item.leagueId));
    }

    notice = formatGenerateAllLeagueSchedulesNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Generazione calendari multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function generateAllRandomLineupsAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const summary = await generateAllRandomLineups();

    revalidatePath("/admin");
    revalidatePath("/admin/lineups");

    for (const item of summary.generated) {
      revalidatePath(`/admin/matchdays/${item.result.matchdayId}`);
      revalidatePath(`/leagues/${item.leagueId}`);
      revalidateLeaguePaths(item.leagueId);

      const teams = await prisma.fantasyTeam.findMany({
        where: { leagueId: item.leagueId },
        select: { id: true }
      });
      for (const team of teams) {
        revalidatePath(`/me/teams/${team.id}`);
        revalidatePath(
          `/me/teams/${team.id}/matchdays/${item.result.matchdayId}/lineup`
        );
      }
    }

    notice = formatGenerateAllRandomLineupsNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Generazione formazioni multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function openAllLineupsAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const summary = await openAllLineups();

    revalidatePath("/admin");
    revalidatePath("/admin/lineups");

    for (const item of summary.opened) {
      revalidateAdminPaths(item.result.matchdayId, item.leagueId);
      revalidatePath(`/leagues/${item.leagueId}`);
      revalidateLeaguePaths(item.leagueId);

      const teams = await prisma.fantasyTeam.findMany({
        where: { leagueId: item.leagueId },
        select: { id: true }
      });
      for (const team of teams) {
        revalidatePath(`/me/teams/${team.id}`);
        revalidatePath(
          `/me/teams/${team.id}/matchdays/${item.result.matchdayId}/lineup`
        );
      }
    }

    notice = formatOpenAllLineupsNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Apertura formazioni multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function lockAllLineupsAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const summary = await lockAllLineups();

    revalidatePath("/admin");
    revalidatePath("/admin/lineups");

    for (const item of summary.locked) {
      revalidateAdminPaths(item.result.matchdayId, item.leagueId);
      revalidatePath(`/leagues/${item.leagueId}`);
      revalidateLeaguePaths(item.leagueId);

      const teams = await prisma.fantasyTeam.findMany({
        where: { leagueId: item.leagueId },
        select: { id: true }
      });
      for (const team of teams) {
        revalidatePath(`/me/teams/${team.id}`);
        revalidatePath(
          `/me/teams/${team.id}/matchdays/${item.result.matchdayId}/lineup`
        );
      }
    }

    notice = formatLockAllLineupsNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Chiusura formazioni multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function calculateAllScoresAndResultsAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  const matchdayNumberRaw = readOptionalString(formData, "matchdayNumber");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    let matchdayNumber: number | undefined;
    if (matchdayNumberRaw != null) {
      const parsed = Number(matchdayNumberRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Numero giornata non valido.");
      }
      matchdayNumber = parsed;
    }

    const summary = await calculateAllScoresAndResults(
      matchdayNumber != null ? { matchdayNumber } : {}
    );

    // Keep post-work cache work light so the action can still redirect before
    // Railway/proxy ~60s kills the connection after a long batch.
    revalidatePath("/admin");
    revalidatePath("/admin/votes");
    const touchedLeagueIds = new Set<string>();
    for (const item of summary.calculated) {
      revalidatePath(`/admin/matchdays/${item.matchdayId}`);
      revalidatePath(`/admin/matchdays/${item.matchdayId}/scores`);
      touchedLeagueIds.add(item.leagueId);
    }
    for (const leagueId of touchedLeagueIds) {
      revalidatePath(`/leagues/${leagueId}`);
      revalidatePath(`/leagues/${leagueId}/standings`);
      revalidatePath(`/admin/leagues/${leagueId}/standings`);
    }

    notice = formatCalculateAllScoresAndResultsNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Calcolo punteggi/risultati multi-lega non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function publishAllMatchdaysAction(formData: FormData) {
  await assertAdminAction();

  const redirectPath =
    readOptionalString(formData, "redirectPath") ?? "/admin";
  const matchdayNumberRaw = readOptionalString(formData, "matchdayNumber");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    let matchdayNumber: number | undefined;
    if (matchdayNumberRaw != null) {
      const parsed = Number(matchdayNumberRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Numero giornata non valido.");
      }
      matchdayNumber = parsed;
    }

    const summary = await publishAllMatchdays(
      matchdayNumber != null ? { matchdayNumber } : {}
    );

    revalidatePath("/admin");
    revalidatePath("/admin/votes");

    for (const item of summary.published) {
      revalidateAdminPaths(item.matchdayId, item.leagueId);
      revalidatePath(`/leagues/${item.leagueId}`);
      revalidateLeaguePaths(item.leagueId);
    }

    notice = formatPublishAllMatchdaysNotice(summary);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Pubblicazione giornate multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function openLineupsAction(matchdayId: string, _formData: FormData) {
  await assertLeagueOpsAction();

  try {
    const result = await openMatchdayLineups(matchdayId);

    revalidateAdminPaths(result.matchdayId, result.leagueId);
    redirectWithMessage(buildAdminMatchdayPath(result.matchdayId), {
      notice: `Inserimento formazioni aperto per la giornata ${result.matchdayNumber}.`
    });
  } catch (error) {
    redirectWithMessage(buildAdminMatchdayPath(matchdayId), {
      error:
        error instanceof Error
          ? error.message
          : "Apertura formazioni non riuscita."
    });
  }
}

export async function lockLineupsAction(matchdayId: string, _formData: FormData) {
  await assertLeagueOpsAction();

  try {
    const result = await lockMatchdayLineups(matchdayId);

    revalidateAdminPaths(result.matchdayId, result.leagueId);
    redirectWithMessage(buildAdminMatchdayPath(result.matchdayId), {
      notice: `Formazioni chiuse per la giornata ${result.matchdayNumber}.`
    });
  } catch (error) {
    redirectWithMessage(buildAdminMatchdayPath(matchdayId), {
      error:
        error instanceof Error
          ? error.message
          : "Chiusura formazioni non riuscita."
    });
  }
}

export async function savePlayerVoteAction(formData: FormData) {
  await assertVotesAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const playerId = readRequiredString(formData, "playerId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  const isSv = formData.get("isSv") === "on";
  const baseVote = isSv ? null : readOptionalNumber(formData, "baseVote");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await savePlayerVote({
      assists: readCounter(formData, "assists"),
      baseVote,
      cleanSheet: readCounter(formData, "cleanSheet"),
      goals: readCounter(formData, "goals"),
      goalsConceded: readCounter(formData, "goalsConceded"),
      isSv,
      matchdayId,
      notes:
        typeof formData.get("notes") === "string"
          ? String(formData.get("notes"))
          : null,
      ownGoals: readCounter(formData, "ownGoals"),
      penaltiesMissed: readCounter(formData, "penaltiesMissed"),
      penaltiesSaved: readCounter(formData, "penaltiesSaved"),
      penaltiesScored: readCounter(formData, "penaltiesScored"),
      playerId,
      redCards: readCounter(formData, "redCards"),
      yellowCards: readCounter(formData, "yellowCards")
    });

    await checkVotesCompletion(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Voto salvato per ${result.playerId}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Salvataggio non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function saveSinglePlayerVoteFromBulkAction(
  playerId: string,
  formData: FormData
) {
  await assertVotesAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const parsedVote = buildBulkVoteInput(formData, matchdayId, playerId);

    if (parsedVote.kind === "skip") {
      throw new Error("Nessun dato da salvare per questo giocatore.");
    }

    if (parsedVote.kind === "invalid") {
      throw new Error(`Riga non valida: ${parsedVote.reason}.`);
    }

    const result = await savePlayerVote(parsedVote.input);
    await checkVotesCompletion(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Voto salvato per ${result.playerId}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Salvataggio non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function importFantacalcioVotesFileAction(formData: FormData) {
  await assertVotesAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  const sheetNameRaw = readOptionalString(formData, "sheetName");
  const fileValue = formData.get("votesFile");

  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (!(fileValue instanceof File) || fileValue.size === 0) {
      throw new Error("Seleziona un file XLS/XLSX dei voti Fantacalcio.");
    }

    const fileName = fileValue.name.toLowerCase();
    if (!fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      throw new Error("Formato non supportato. Carica un file .xls o .xlsx.");
    }

    const buffer = await fileToOwnedBuffer(fileValue);
    const result = await importFantacalcioVotesFromBuffer({
      buffer,
      matchdayId,
      sheetName: sheetNameRaw || undefined
    });

    revalidateAdminPaths(matchdayId, leagueId);

    const unmatchedPreview =
      result.skippedUnmatchedCodes.length > 0
        ? ` Codici non in DB: ${result.skippedUnmatchedCodes.slice(0, 8).join(", ")}${result.skippedUnmatchedCodes.length > 8 ? "…" : ""}.`
        : "";

    notice = `Import voti (${result.sheetName}): ${result.savedCount} salvati, ${result.matchedCount} dal file, ${result.missingMarkedSvCount} SV per assenti.${unmatchedPreview}`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Import voti non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function saveBulkPlayerVotesAction(formData: FormData) {
  await assertVotesAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  const playerIds = Array.from(
    new Set(
      formData
        .getAll("playerIds")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const savedPlayerIds: string[] = [];
    const invalidRows: string[] = [];
    let skippedCount = 0;

    for (const playerId of playerIds) {
      const playerLabel = readVotePlayerLabel(formData, playerId);
      const parsedVote = buildBulkVoteInput(formData, matchdayId, playerId);

      if (parsedVote.kind === "skip") {
        skippedCount += 1;
        continue;
      }

      if (parsedVote.kind === "invalid") {
        invalidRows.push(`${playerLabel}: ${parsedVote.reason}`);
        continue;
      }

      const result = await savePlayerVote(parsedVote.input);
      savedPlayerIds.push(result.playerId);
    }

    if (savedPlayerIds.length > 0) {
      await checkVotesCompletion(matchdayId);
    }

    revalidateAdminPaths(matchdayId, leagueId);

    if (savedPlayerIds.length === 0 && invalidRows.length === 0) {
      notice = "Nessuna riga compilata da salvare. Le righe vuote sono state ignorate.";
    } else if (invalidRows.length > 0) {
      errorMessage = `Salvati ${savedPlayerIds.length} voti. Righe vuote ignorate: ${skippedCount}. Righe non valide: ${invalidRows.join(" | ")}.`;
    } else {
      notice = `Salvati ${savedPlayerIds.length} voti. Righe vuote ignorate: ${skippedCount}.`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Salvataggio bulk non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function saveSingleUnifiedPlayerVoteAction(
  playerId: string,
  formData: FormData
) {
  await assertVotesAction();
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const matchdayIds = readPlayerMatchdayIds(formData, playerId);
    const result = await saveVoteAcrossMatchdays(formData, playerId, matchdayIds);

    if (result.kind === "skip") {
      throw new Error("Nessun dato da salvare per questo giocatore.");
    }

    if (result.kind === "invalid") {
      throw new Error(`Riga non valida: ${result.reason}.`);
    }

    for (const matchdayId of matchdayIds) {
      await checkVotesCompletion(matchdayId);
      revalidateAdminPaths(matchdayId);
    }

    notice = `Voto salvato su ${result.matchdayCount} leghe per ${result.playerId}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Salvataggio unificato non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function saveBulkUnifiedPlayerVotesAction(formData: FormData) {
  await assertVotesAction();
  const redirectPath = readRequiredString(formData, "redirectPath");
  const playerIds = Array.from(
    new Set(
      formData
        .getAll("playerIds")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const savedPlayerIds: string[] = [];
    const touchedMatchdayIds = new Set<string>();
    const invalidRows: string[] = [];
    let skippedCount = 0;
    let fanOutCount = 0;

    for (const playerId of playerIds) {
      const playerLabel = readVotePlayerLabel(formData, playerId);
      const matchdayIds = readPlayerMatchdayIds(formData, playerId);
      const result = await saveVoteAcrossMatchdays(
        formData,
        playerId,
        matchdayIds
      );

      if (result.kind === "skip") {
        skippedCount += 1;
        continue;
      }

      if (result.kind === "invalid") {
        invalidRows.push(`${playerLabel}: ${result.reason}`);
        continue;
      }

      savedPlayerIds.push(playerId);
      fanOutCount += result.matchdayCount;
      for (const matchdayId of matchdayIds) {
        touchedMatchdayIds.add(matchdayId);
      }
    }

    for (const matchdayId of touchedMatchdayIds) {
      await checkVotesCompletion(matchdayId);
      revalidateAdminPaths(matchdayId);
    }

    revalidatePath("/admin/votes");

    if (savedPlayerIds.length === 0 && invalidRows.length === 0) {
      notice =
        "Nessuna riga compilata da salvare. Le righe vuote sono state ignorate.";
    } else if (invalidRows.length > 0) {
      errorMessage = `Salvati ${savedPlayerIds.length} giocatori (${fanOutCount} voti multi-lega). Ignorati: ${skippedCount}. Non validi: ${invalidRows.join(" | ")}.`;
    } else {
      notice = `Salvati ${savedPlayerIds.length} giocatori su ${fanOutCount} voti multi-lega. Ignorati: ${skippedCount}.`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Salvataggio bulk unificato non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function generateRequiredVotesForUnifiedMatchdayNumberAction(
  formData: FormData
) {
  await assertVotesAction();
  const redirectPath = readRequiredString(formData, "redirectPath");
  const matchdayNumber = Number(readRequiredString(formData, "matchdayNumber"));
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (!Number.isInteger(matchdayNumber) || matchdayNumber <= 0) {
      throw new Error("Numero giornata non valido.");
    }

    const matchdays = await loadMatchdaysForUnifiedNumber(matchdayNumber);
    if (matchdays.length === 0) {
      throw new Error("Nessuna giornata trovata per questo numero.");
    }

    let totalRequired = 0;
    for (const matchday of matchdays) {
      const result = await generateRequiredVotePlayers(matchday.id);
      totalRequired += result.totalRequired;
      revalidateAdminPaths(matchday.id, matchday.leagueId);
    }

    notice = `Liste voti generate su ${matchdays.length} leghe (giornata ${matchdayNumber}). Totale richiesti: ${totalRequired}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Generazione liste voti multi-lega non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function importFantacalcioVotesAcrossLeaguesAction(
  formData: FormData
) {
  await assertVotesAction();
  const redirectPath = readRequiredString(formData, "redirectPath");
  const matchdayNumber = Number(readRequiredString(formData, "matchdayNumber"));
  const sheetNameRaw = readOptionalString(formData, "sheetName");
  const fileValue = formData.get("votesFile");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (!Number.isInteger(matchdayNumber) || matchdayNumber <= 0) {
      throw new Error("Numero giornata non valido.");
    }

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      throw new Error("Seleziona un file XLS/XLSX dei voti Fantacalcio.");
    }

    const fileName = fileValue.name.toLowerCase();
    if (!fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      throw new Error("Formato non supportato. Carica un file .xls o .xlsx.");
    }

    const matchdays = await loadMatchdaysForUnifiedNumber(matchdayNumber);
    if (matchdays.length === 0) {
      throw new Error("Nessuna giornata trovata per questo numero.");
    }

    const buffer = await fileToOwnedBuffer(fileValue);
    // Built-in ensureRequiredLists generates missing required-vote lists for
    // every eligible league first, then imports with bounded concurrency so
    // Railway's ~60s silent-proxy window can cover all leagues in one click.
    const summary = await importFantacalcioVotesAcrossMatchdays({
      buffer,
      concurrency: 3,
      ensureRequiredLists: true,
      matchdays: matchdays.map((matchday) => ({
        id: matchday.id,
        leagueId: matchday.leagueId,
        leagueName: matchday.league.name
      })),
      sheetName: sheetNameRaw || undefined
    });

    revalidatePath("/admin");
    revalidatePath("/admin/votes");
    for (const item of summary.succeeded) {
      revalidatePath(`/admin/matchdays/${item.matchdayId}/votes`);
    }
    for (const item of summary.failed) {
      revalidatePath(`/admin/matchdays/${item.matchdayId}/votes`);
    }

    notice = formatImportFantacalcioVotesAcrossMatchdaysNotice(
      summary,
      matchdayNumber
    );

    if (summary.failed.length > 0) {
      // Surface per-league failures clearly (Feedback shows error styling).
      errorMessage = notice;
      notice = undefined;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Import voti multi-lega non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function generateDemoVotesForPendingPlayersAction(
  matchdayId: string,
  redirectPath?: string
) {
  await assertVotesAction();
  const targetRedirectPath =
    redirectPath ?? `/admin/matchdays/${matchdayId}/votes?status=PENDING`;
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const matchday = await prisma.matchday.findUnique({
      where: {
        id: matchdayId
      },
      select: {
        id: true,
        leagueId: true
      }
    });

    if (!matchday) {
      throw new Error(`Matchday ${matchdayId} not found.`);
    }

    const pendingPlayers = await prisma.requiredVotePlayer.findMany({
      where: {
        matchdayId,
        status: RequiredVoteStatus.PENDING
      },
      select: {
        playerId: true
      }
    });

    if (pendingPlayers.length === 0) {
      notice = "Nessun giocatore pending da compilare.";
    } else {
      let generatedCount = 0;
      let svCount = 0;
      let fallbackCount = 0;

      for (const pendingPlayer of pendingPlayers) {
        const demoVote = generateCoherentDemoVote();

        if (demoVote.isSv) {
          svCount += 1;
        }

        if (demoVote.usedFallback) {
          fallbackCount += 1;
        }

        await savePlayerVote({
          assists: demoVote.assists,
          baseVote: demoVote.baseVote,
          cleanSheet: demoVote.cleanSheet,
          goals: demoVote.goals,
          isSv: demoVote.isSv,
          matchdayId,
          notes: demoVote.notes,
          ownGoals: demoVote.ownGoals,
          penaltiesMissed: demoVote.penaltiesMissed,
          penaltiesSaved: demoVote.penaltiesSaved,
          playerId: pendingPlayer.playerId,
          redCards: demoVote.redCards,
          yellowCards: demoVote.yellowCards
        });

        generatedCount += 1;
      }

      await checkVotesCompletion(matchdayId);
      revalidateAdminPaths(matchdayId, matchday.leagueId);

      notice = `Voti demo generati: ${generatedCount}. SV: ${svCount}. Fallback usati: ${fallbackCount}.`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Generazione voti demo non riuscita.";
  }

  redirectWithMessage(targetRedirectPath, { error: errorMessage, notice });
}

export async function calculateMatchdayScoresAction(formData: FormData) {
  await assertLeagueOpsAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await calculateMatchdayScores(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Punteggi calcolati per ${result.teamsScored.length} squadre.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Calcolo punteggi non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function publishMatchdayAction(formData: FormData) {
  await assertLeagueOpsAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await publishMatchday(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Giornata pubblicata. Team score pubblicati: ${result.publishedTeamScoresCount}. Fixture pubblicate: ${result.publishedFixturesCount}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Pubblicazione non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function generateFantasyFixturesAction(formData: FormData) {
  await assertLeagueOpsAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await generateFantasyFixtures(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Scontri generati: ${result.createdCount}. Totale fixture attese: ${result.totalFixtures}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Generazione scontri non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function calculateFantasyFixtureResultsAction(formData: FormData) {
  await assertLeagueOpsAction();
  const matchdayId = readRequiredString(formData, "matchdayId");
  const leagueId = readOptionalString(formData, "leagueId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await calculateFantasyFixtureResults(matchdayId);
    revalidateAdminPaths(matchdayId, leagueId);
    notice = `Risultati scontri calcolati: ${result.calculatedCount}.`;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Calcolo risultati scontri non riuscito.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function resetLeagueDataAction(formData: FormData) {
  await assertAdminAction();

  const confirmation = formData.get("confirmation");

  if (confirmation !== "RESET LEGHE") {
    redirectWithMessage("/admin", {
      error: "Conferma non valida. Inserisci esattamente RESET LEGHE."
    });
  }

  try {
    const summary = await resetLeagueData();

    revalidatePath("/admin");
    revalidatePath("/leagues");
    revalidatePath("/me");

    redirectWithMessage("/admin", {
      notice: `Reset completato. Leghe: ${summary.leagueCount}, squadre: ${summary.fantasyTeamCount}, giornate: ${summary.matchdayCount}, formazioni: ${summary.lineupCount}.`
    });
  } catch (error) {
    redirectWithMessage("/admin", {
      error:
        error instanceof Error
          ? error.message
          : "Reset dati leghe non riuscito."
    });
  }
}

export async function generateRandomLineupsForMatchdayAction(
  formData: FormData
) {
  await assertAdminAction();

  const leagueId = readRequiredString(formData, "leagueId");
  const matchdayId = readRequiredString(formData, "matchdayId");
  const redirectPath = readOptionalString(formData, "redirectPath") ?? "/admin";
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await generateRandomLineupsForMatchday({
      force: true,
      leagueId,
      matchdayId
    });

    revalidatePath("/admin");
    revalidatePath("/admin/lineups");
    revalidatePath(`/admin/matchdays/${matchdayId}`);
    revalidatePath(`/leagues/${leagueId}`);

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true }
    });
    for (const team of teams) {
      revalidatePath(`/me/teams/${team.id}`);
      revalidatePath(`/me/teams/${team.id}/matchdays/${matchdayId}/lineup`);
    }

    if (result.written === 0 && result.failures.length > 0) {
      const preview = result.failures
        .slice(0, 3)
        .map((failure) => `${failure.teamName}: ${failure.error}`)
        .join(" | ");
      throw new Error(
        `Nessuna formazione generata. ${preview}${result.failures.length > 3 ? "…" : ""}`
      );
    }

    const failureSuffix =
      result.failures.length > 0
        ? ` Fallite: ${result.failures.length} (${result.failures
            .slice(0, 2)
            .map((failure) => failure.teamName)
            .join(", ")}${result.failures.length > 2 ? "…" : ""}).`
        : "";

    notice = `Formazioni casuali generate per la giornata ${result.matchdayNumber}: ${result.written} scritte.${failureSuffix}`;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Generazione formazioni casuali non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

function revalidateAdminRosterPaths(options: {
  fantasyTeamId: string;
  leagueId: string;
}) {
  revalidatePath("/admin");
  revalidatePath(`/admin/leagues/${options.leagueId}/teams`);
  revalidatePath(`/admin/teams/${options.fantasyTeamId}/roster`);
  revalidatePath(`/me/teams/${options.fantasyTeamId}`);
  revalidatePath(`/me/teams/${options.fantasyTeamId}/roster`);
  revalidatePath(`/leagues/${options.leagueId}`);
}

export async function adminAddPlayerToRosterAction(formData: FormData) {
  await assertAdminAction();
  const teamId = readRequiredString(formData, "teamId");
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await adminAddPlayerToRoster({
      fantasyTeamId: teamId,
      playerId
    });
    revalidateAdminRosterPaths(result);
    notice = `Giocatore aggiunto. Rosa: ${result.rosterCount}/25.`;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Aggiunta giocatore non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function adminRemovePlayerFromRosterAction(formData: FormData) {
  await assertAdminAction();
  const teamId = readRequiredString(formData, "teamId");
  const playerId = readRequiredString(formData, "playerId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await adminRemovePlayerFromRoster({
      fantasyTeamId: teamId,
      playerId
    });
    revalidateAdminRosterPaths(result);
    notice = `Giocatore rimosso. Rosa: ${result.rosterCount}/25.`;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Rimozione giocatore non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function adminReplacePlayerInRosterAction(formData: FormData) {
  await assertAdminAction();
  const teamId = readRequiredString(formData, "teamId");
  const outgoingPlayerId = readRequiredString(formData, "outgoingPlayerId");
  const incomingPlayerId = readRequiredString(formData, "incomingPlayerId");
  const redirectPath = readRequiredString(formData, "redirectPath");
  let notice: string | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await adminReplacePlayerInRoster({
      fantasyTeamId: teamId,
      incomingPlayerId,
      outgoingPlayerId
    });
    revalidateAdminRosterPaths(result);
    notice = `Sostituzione completata. Rosa: ${result.rosterCount}/25.`;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Sostituzione giocatore non riuscita.";
  }

  redirectWithMessage(redirectPath, { error: errorMessage, notice });
}

export async function setUserAppRoleAction(formData: FormData) {
  const authContext = await assertCanAssignAppRoles();
  const userId = readRequiredString(formData, "userId");
  const roleRaw = readRequiredString(formData, "role");
  const role = parseAppRole(roleRaw);
  let notice: string | undefined;
  let errorMessage: string | undefined;

  if (!role) {
    redirectWithMessage("/admin/permessi", {
      error: "Ruolo non valido. Usa Utente, Mister o Admin."
    });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!target) {
      throw new Error("Utente non trovato.");
    }

    if (target.role === role) {
      notice = `Nessuna modifica: ${target.email} e gia ${role}.`;
    } else {
      const demotingSelf =
        target.id === authContext.appUser.id &&
        target.role === UserRole.ADMIN &&
        role !== UserRole.ADMIN;

      if (demotingSelf) {
        const otherAdmins = await prisma.user.count({
          where: {
            role: UserRole.ADMIN,
            id: { not: target.id }
          }
        });

        if (otherAdmins === 0) {
          throw new Error(
            "Non puoi rimuovere l'ultimo Admin. Promuovi prima un altro utente."
          );
        }
      }

      await prisma.user.update({
        where: { id: target.id },
        data: { role }
      });

      notice = `Ruolo aggiornato: ${target.email} → ${role}.`;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/permessi");
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Assegnazione ruolo non riuscita.";
  }

  redirectWithMessage("/admin/permessi", { error: errorMessage, notice });
}
