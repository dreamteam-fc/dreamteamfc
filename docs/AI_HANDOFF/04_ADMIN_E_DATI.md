# 04 — Admin e dati

Gate ruoli: `lib/auth/app-roles.ts`, `lib/auth/admin.ts`.  
Actions: `app/admin/actions.ts` (molto grosso — cerca per nome action).

---

## Matrice capacità

| Capacità | USER | MISTER | ADMIN |
|----------|:----:|:------:|:-----:|
| Area `/admin` | | ✓ | ✓ |
| Pagelle XLS / voti / score per giornata | | ✓ | ✓ |
| Hub formazioni `/admin/lineups` | | ✓ | ✓ |
| Batch multi-lega dashboard (`/admin`) | | | ✓ |
| Crea leghe, tornei, permessi | | | ✓ |
| Catalogo players wipe/sync | | | ✓ |
| CRUD rosa admin post-lock | | | ✓ |
| Wipe tornei / wipe leghe | | | ✓ |

`canManagePlatform` = solo ADMIN → nasconde bottoni batch/wipe su dashboard.  
Mister lavora **giornata-per-giornata** + `/admin/votes`. Non confondere “ops complete” con “vede tutti i batch”.

---

## Dashboard `/admin` — batch (solo Admin)

Tipici bottoni multi-lega (implementati in actions + `lib/server/*`):

1. Genera calendari (tutte le leghe senza schedule)  
2. Genera formazioni casuali  
3. Apri / chiudi formazioni (alla chiusura: auto-carry lineup mancanti)  
4. Calcola punteggi + risultati  
5. Pubblica giornate  

Concurrency limitata nei batch (proxy Railway ~60s). Path: `open-all-lineups.ts`, `lock-all-lineups.ts` (+ `auto-carry-matchday-lineups.ts`), `calculate-all-scores-and-results.ts`, `publish-all-matchdays.ts`, `generate-all-league-schedules.ts`, `generate-all-random-lineups.ts`.

**Formazioni alla chiusura:** se manca lineup → copia ultima `USER` (`AUTO_CARRIED`, −2 FP + −1 classifica) oppure forfait. Dettaglio: `REGOLAMENTO` §4 / `AI_HANDOFF/03`.

---

## Pagelle unificate `/admin/votes`

- Mister + Admin  
- Seleziona **numero giornata** → fan-out multi-lega  
- Genera liste se serve → upload XLS foglio default `Fantacalcio`  
- `maxDuration` alto sulla route (proxy-safe mitigations)  
- Parser: `lib/server/votes/parse-fantacalcio-votes-xls.ts`  
- Import: `lib/server/votes/import-fantacalcio-votes.ts`  
- Esempio file: `data/voti-fantacalcio-esempio-giornata-38.xlsx` (o XLS in root repo)

### Matching voti (invariante)

```
XLS colonna "Cod."  ==  Player.externalId
Player.source       ==  "fantacalcio-quotazioni"
```

Righe “nome squadra” senza codice numerico → ignorare.

---

## Catalogo `/admin/players`

| Mode | Quando | Effetto |
|------|--------|---------|
| **WIPE** | solo se `leghe=0` e `tornei=0` | Svuota/ricostruisce catalogo |
| **SYNC** | stagione in corso | Upsert per `externalId`; disattiva/rimuove altre sorgenti non referenziate |

Lib: `sync-fantacalcio-quotazioni-catalog.ts`, parse `parse-fantacalcio-quotazioni.ts`.  
CLI: `npm run players:import-fantacalcio`.

---

## Zona pericolosa (fine stagione)

Su `/admin` (Admin), conferma testuale:

1. Digita `WIPE TORNEO` → `lib/server/admin/wipe-tournaments.ts`  
2. Digita `WIPE LEGHE` → `lib/server/admin/wipe-leagues.ts`  
3. Upload catalogo quotazioni in mode WIPE (solo a riferimenti vuoti)  
4. Ricrea leghe

Ordine obbligatorio: **tornei → leghe → catalogo**. Non c’è archivio stagione.

Reset lega meno distruttivo (script/admin): `lib/server/admin/reset-league-data.ts`, `npm run db:reset-leagues`.

---

## Torneo admin

| Route | Uso |
|-------|-----|
| `/admin/tournaments` | Lista / new |
| `.../entries` | Squadre + lega + password |
| `.../bracket` | Apri/chiudi formazioni fase, voti XLS per leg, calcola, pick tie, reset |

Libs tipiche: `generate-tournament-bracket.ts`, `open/lock-tournament-round-lineups.ts`, `import-tournament-votes.ts`, `calculate-tournament-round-results.ts`, `pick-tournament-series-winner.ts`, `reset-tournament-round-results.ts`, `reset-tournament-to-entries.ts`.

---

## Workflow utente (per contrasto)

| Path | Cosa |
|------|------|
| Join lega | `/leagues/...` + password |
| Crea squadra / rosa | `/me/teams/...` |
| Lineup lega | `/me/teams/[teamId]/...` matchday |
| Lineup torneo | `/me/teams/[teamId]/tournaments/fixtures/.../lineup` |
| Logo | upload WebP Sharp → Storage; body limit 6mb in `next.config.ts` |
| Coach | invite da owner → accept token |

Actions utente: `app/me/actions.ts`.

---

## Runbook settimana (ops, no code)

Vedi [`../ANALISI_STATO_PROGETTO_2026-08-05.md`](../ANALISI_STATO_PROGETTO_2026-08-05.md) §6 — apri → chiudi → XLS → calcola → pubblica.
