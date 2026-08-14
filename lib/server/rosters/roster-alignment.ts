import { LeagueStatus, type PlayerRole } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type UnalignedRosterPlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  teamName: string | null;
};

export type UnalignedRoster = {
  fantasyTeamId: string;
  fantasyTeamName: string;
  leagueId: string;
  leagueName: string;
  players: UnalignedRosterPlayer[];
  /** Totale giocatori in rosa (non filtrato): serve solo come warning 24/25. */
  rosterCount: number;
};

/**
 * Rose da sanare dopo un import lista: contengono almeno un giocatore uscito
 * dal file Fantacalcio (`Player.isActive = false`), nelle sole leghe ACTIVE.
 *
 * Volutamente NON usa validateRosterComposition: una rosa mai completata
 * (utente nuovo, lega in setup) non è "da riallineare" e terrebbe il freeze
 * acceso per sempre senza che nessun intervento admin possa spegnerlo.
 * Il conteggio rosa viaggia come warning in pagina, non come blocco.
 */
export async function listUnalignedRosters(): Promise<UnalignedRoster[]> {
  const teams = await prisma.fantasyTeam.findMany({
    where: {
      league: { status: LeagueStatus.ACTIVE },
      roster: { some: { player: { isActive: false } } }
    },
    select: {
      id: true,
      name: true,
      league: {
        select: {
          id: true,
          name: true
        }
      },
      _count: {
        select: {
          roster: true
        }
      },
      roster: {
        where: { player: { isActive: false } },
        select: {
          player: {
            select: {
              id: true,
              name: true,
              role: true,
              teamName: true
            }
          }
        }
      }
    },
    orderBy: [{ league: { name: "asc" } }, { name: "asc" }]
  });

  return teams.map((team) => ({
    fantasyTeamId: team.id,
    fantasyTeamName: team.name,
    leagueId: team.league.id,
    leagueName: team.league.name,
    players: team.roster.map((entry) => entry.player),
    rosterCount: team._count.roster
  }));
}

/**
 * Sceglie quali righe di formazione riassegnare all'entrante quando l'admin
 * sostituisce un giocatore in rosa (vedi swapPlayerInPendingLineups).
 *
 * Pura e separata perché è l'unico punto che può violare
 * `@@unique([lineupId, playerId])`: le formazioni dove l'entrante è già
 * presente vanno saltate, non aggiornate.
 */
export function selectLineupPlayerIdsToSwap(
  targets: Array<{ id: string; lineupId: string }>,
  lineupIdsWithIncoming: Iterable<string>
): string[] {
  const conflicting = new Set(lineupIdsWithIncoming);

  return targets
    .filter((target) => !conflicting.has(target.lineupId))
    .map((target) => target.id);
}

/**
 * Freeze: nessuna nuova giornata (lega o torneo) può aprire le formazioni
 * finché tutte le rose non sono allineate alla lista giocatori corrente.
 * Chiamare in testa a ogni entry point che *crea* formazioni.
 */
export async function assertRostersAligned(): Promise<void> {
  const unaligned = await listUnalignedRosters();

  if (unaligned.length === 0) {
    return;
  }

  throw new Error(
    `Rose non allineate alla lista giocatori: ${unaligned.length} squadre da sanare. Apri /admin/rose-da-sanare e sostituisci i giocatori non più disponibili.`
  );
}
