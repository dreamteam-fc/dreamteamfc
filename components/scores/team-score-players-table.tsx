import type { ScorePlayerFinalType, SlotType } from "@prisma/client";

import { describeFantavoteBreakdown } from "@/lib/scoring/format-fantavote-breakdown";
import type { FantavoteBreakdownVote } from "@/lib/scoring/format-fantavote-breakdown";

const DETAIL_LABELS: Record<ScorePlayerFinalType, string> = {
  AUTO_SUB_IN: "Entrato dalla panchina",
  BENCH_UNUSED: "Panchina non usata",
  REPLACED_BY_BENCH: "Sostituito",
  STARTER_PLAYED: "Titolare",
  SV_NOT_REPLACED: "SV non sostituito"
};

const SLOT_LABELS = {
  BENCH: "Panchina",
  STARTER: "Titolare"
} as const;

export type TeamScorePlayerRow = {
  countsForScore: boolean;
  finalFantavote: number | null;
  finalType: ScorePlayerFinalType;
  id: string;
  isSv: boolean;
  player: { id: string; name: string };
  positionOrder: number;
  replacedLineupPlayer: {
    id: string;
    player: { id: string; name: string };
  } | null;
  slotType: SlotType;
  vote: FantavoteBreakdownVote | null;
};

function formatScore(value: number | null) {
  if (value === null) {
    return "-";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getDetailDescription(player: TeamScorePlayerRow) {
  if (
    player.finalType === "AUTO_SUB_IN" &&
    player.replacedLineupPlayer
  ) {
    return `Entra al posto di ${player.replacedLineupPlayer.player.name}`;
  }

  if (
    player.finalType === "REPLACED_BY_BENCH" &&
    player.replacedLineupPlayer
  ) {
    return `Sostituisce ${player.replacedLineupPlayer.player.name}`;
  }

  if (player.finalType === "REPLACED_BY_BENCH") {
    return "Il titolare viene sostituito da un panchinaro valido.";
  }

  if (player.finalType === "SV_NOT_REPLACED") {
    return "Il giocatore vale 0 per mancanza di sostituto valido.";
  }

  if (player.finalType === "BENCH_UNUSED") {
    return "Rimasto in panchina senza entrare.";
  }

  if (player.finalType === "STARTER_PLAYED") {
    return "Titolare con voto valido.";
  }

  return null;
}

export function TeamScorePlayersTable({
  players,
  teamName,
  totalScore
}: {
  players: TeamScorePlayerRow[];
  teamName: string;
  totalScore: number | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {teamName}
        </h3>
        <span className="text-sm text-slate-600">
          Totale: <strong>{formatScore(totalScore)}</strong>
        </span>
      </div>

      {players.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          Nessun dettaglio giocatori pubblicato per questa squadra.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Giocatore</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Dettaglio</th>
                <th className="px-3 py-2 font-medium">Conta</th>
                <th className="px-3 py-2 font-medium">Base</th>
                <th className="px-3 py-2 font-medium">Bonus / Malus</th>
                <th className="px-3 py-2 font-medium">Fantavoto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((player) => {
                const breakdown = describeFantavoteBreakdown(player.vote);
                const bonusMalusLabel =
                  breakdown.isSv
                    ? "SV"
                    : [...breakdown.bonusParts, ...breakdown.malusParts].join(
                        " "
                      ) || "—";

                return (
                  <tr
                    key={player.id}
                    className={
                      player.countsForScore ? "bg-white" : "bg-slate-50/80"
                    }
                  >
                    <td className="px-3 py-2 text-slate-900">
                      <p className="font-medium">{player.player.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {SLOT_LABELS[player.slotType]} · #{player.positionOrder}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      {DETAIL_LABELS[player.finalType]}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {getDetailDescription(player) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {player.countsForScore ? "Sì" : "No"}
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      {breakdown.isSv
                        ? "SV"
                        : formatScore(breakdown.baseVote)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <span title={breakdown.summary}>{bonusMalusLabel}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {player.countsForScore
                        ? formatScore(player.finalFantavote)
                        : formatScore(player.finalFantavote)}
                      {player.countsForScore && !breakdown.isSv ? (
                        <p className="mt-0.5 text-xs font-normal text-slate-500">
                          {breakdown.summary}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
