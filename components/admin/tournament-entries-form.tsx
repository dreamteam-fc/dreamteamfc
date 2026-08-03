"use client";

import { useMemo, useState } from "react";

import {
  ALLOWED_BRACKET_SIZES_LABEL,
  isAllowedBracketSize
} from "@/lib/tournaments/bracket-size";

type TeamOption = {
  fantasyTeamId: string;
  leagueId: string;
  leagueName: string;
  leaguePoints: number;
  ownerEmail: string;
  ownerName: string | null;
  seasonCompleteHint: boolean;
  teamName: string;
};

type LeagueGroup = {
  leagueId: string;
  leagueName: string;
  publishedMatchdays: number;
  seasonCompleteHint: boolean;
  teams: TeamOption[];
  totalMatchdays: number;
};

type TournamentEntriesFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  groups: LeagueGroup[];
  initialSelectedIds: string[];
  readOnly: boolean;
  tournamentId: string;
};

export function TournamentEntriesForm({
  action,
  groups,
  initialSelectedIds,
  readOnly,
  tournamentId
}: TournamentEntriesFormProps) {
  const [selected, setSelected] = useState(() => new Set(initialSelectedIds));
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [query, setQuery] = useState("");

  const selectedCount = selected.size;
  const powerOk = isAllowedBracketSize(selectedCount);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return groups
      .filter((group) => leagueFilter === "all" || group.leagueId === leagueFilter)
      .map((group) => ({
        ...group,
        teams: group.teams.filter((team) => {
          if (normalizedQuery.length === 0) {
            return true;
          }

          const haystack = [
            team.teamName,
            team.ownerEmail,
            team.ownerName ?? "",
            team.leagueName
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        })
      }))
      .filter((group) => group.teams.length > 0);
  }, [groups, leagueFilter, query]);

  function toggleTeam(teamId: string) {
    if (readOnly) {
      return;
    }

    setSelected((current) => {
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {Array.from(selected).map((teamId) => (
        <input
          key={teamId}
          type="hidden"
          name="fantasyTeamId"
          value={teamId}
        />
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-2 text-sm text-slate-700">
          <span className="font-medium">Filtra lega</span>
          <select
            value={leagueFilter}
            onChange={(event) => setLeagueFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          >
            <option value="all">Tutte le leghe</option>
            {groups.map((group) => (
              <option key={group.leagueId} value={group.leagueId}>
                {group.leagueName}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[16rem] flex-1 space-y-2 text-sm text-slate-700">
          <span className="font-medium">Cerca</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Squadra, proprietario, lega…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <div
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            powerOk
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          Selezionate: {selectedCount}
          {powerOk
            ? " (ok per tabellone)"
            : ` — serve ${ALLOWED_BRACKET_SIZES_LABEL}`}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="text-sm text-slate-600">Nessuna squadra da mostrare.</p>
      ) : (
        visibleGroups.map((group) => (
          <section
            key={group.leagueId}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {group.leagueName}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Giornate pubblicate: {group.publishedMatchdays}/
                  {group.totalMatchdays || 18}
                  {group.seasonCompleteHint
                    ? " — campionato completo"
                    : " — campionato non ancora chiuso"}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Sel.</th>
                    <th className="px-3 py-2 font-medium">Pos. punti</th>
                    <th className="px-3 py-2 font-medium">Squadra</th>
                    <th className="px-3 py-2 font-medium">Proprietario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {group.teams.map((team, index) => {
                    const checked = selected.has(team.fantasyTeamId);
                    return (
                      <tr key={team.fantasyTeamId}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly}
                            onChange={() => toggleTeam(team.fantasyTeamId)}
                            className="h-4 w-4 rounded border-slate-300"
                            aria-label={`Seleziona ${team.teamName}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          #{index + 1} · {team.leaguePoints} pt
                        </td>
                        <td className="px-3 py-2 text-slate-900">
                          {team.teamName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {team.ownerName ?? team.ownerEmail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {!readOnly ? (
        <button
          type="submit"
          disabled={!powerOk}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Salva roster torneo ({selectedCount})
        </button>
      ) : (
        <p className="text-sm text-amber-800">
          Roster bloccato: il tabellone e gia stato generato.
        </p>
      )}
    </form>
  );
}
