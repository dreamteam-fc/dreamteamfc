# 04 — Admin e dati

Gate ruoli: `lib/auth/app-roles.ts`, `lib/auth/admin.ts`.  
Actions: `app/admin/actions.ts` (molto grosso — cerca per nome action).

---

## Matrice capacità

| Capacità | USER | MISTER | ADMIN | Admin principale |
|----------|:----:|:------:|:-----:|:----------------:|
| Area `/admin` (+ link da `/me`) | | ✓ | ✓ | ✓ |
| Pagelle XLS / voti / score per giornata | | ✓ | ✓ | ✓ |
| Hub formazioni `/admin/lineups` | | ✓ | ✓ | ✓ |
| Batch **Apri/Chiudi formazioni (tutte)** | | ✓ | ✓ | ✓ |
| Altri batch dashboard (calendari, random, calcola, pubblica) | | | ✓ | ✓ |
| Crea leghe, tornei, catalogo, wipe, CRUD rosa admin | | | ✓ | ✓ |
| `/admin/permessi` (assegna USER/MISTER/ADMIN) | | | | ✓ |

- **Admin principale** = email `dreamteamfc@proton.me` (override opzionale `PRIMARY_ADMIN_EMAIL`). Solo lui passa `canAssignAppRoles` / `requirePrimaryAdminAccess`. Gli ADMIN nominati **non** assegnano ruoli.
- `canManagePlatform` = solo `UserRole.ADMIN` → wipe, tornei, crea lega, giocatori, random, calendari, calcola/pubblica batch.
- `canManageLeagueOps` / `canManageVotes` = MISTER + ADMIN (ops giornata + apri/chiudi batch + pagelle).
- **Mister ≠ allenatore:** `UserRole.MISTER` è staff piattaforma; TeamCoach è delega formazione (badge admin **MISTER** = `LineupSource.COACH`).

---

## Dashboard `/admin` — batch

| Bottone | Chi |
|---------|-----|
| Apri / Chiudi formazioni (tutte) | Admin + Mister |
| Genera calendari | solo Admin |
| Genera formazioni (random) | solo Admin |
| Calcola punteggi e risultati | solo Admin |
| Pubblica giornate | solo Admin |

Concurrency limitata nei batch (proxy Railway ~60s). Path: `open-all-lineups.ts`, `lock-all-lineups.ts` (+ `auto-carry-matchday-lineups.ts`), `calculate-all-scores-and-results.ts`, `publish-all-matchdays.ts`, `generate-all-league-schedules.ts`, `generate-all-random-lineups.ts`.

**Formazioni alla chiusura:** se manca lineup → copia ultima `USER` o `COACH` (`AUTO_CARRIED`, −2 FP + −1 classifica) oppure forfait. Dettaglio: `REGOLAMENTO` §4 / `AI_HANDOFF/03`.

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
| `.../rounds/[roundId]/votes?leg=` | Pagelle singole torneo (come matchday votes) |

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
| Regolamento / guide | `/regolamento`, `/come-giocare` |

Actions utente: `app/me/actions.ts`.

---

## Runbook settimana (ops, no code)

Vedi [`../ANALISI_STATO_PROGETTO_2026-08-05.md`](../ANALISI_STATO_PROGETTO_2026-08-05.md) §6 — apri → chiudi → XLS → calcola → pubblica.
