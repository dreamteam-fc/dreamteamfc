# 06 — Dove mettere mano (cookbook)

Formato: **se vuoi X → tocca Y**. Preferisci `lib/server/*` per logica; `app/*/actions.ts` solo come entry Server Action; UI in `app/**/page.tsx`.

---

## Auth e ruoli

| Se vuoi… | Tocca |
|----------|-------|
| Cambiare chi può fare cosa | `lib/auth/app-roles.ts` + gate in `lib/auth/admin.ts` + check nelle actions |
| Mapping login → User / bootstrap Admin | `lib/auth/app-user.ts`, env `ADMIN_EMAIL` |
| Assegnare Mister/Admin in UI | `app/admin/permessi/`, action in `app/admin/actions.ts` |

---

## Lega / calendario / giornata

| Se vuoi… | Tocca |
|----------|-------|
| Creare lega / maxTeams / password | `lib/server/admin/create-league.ts`, schema `League` |
| Generare calendario round-robin | `lib/server/schedules/generate-league-schedule.ts`, `generate-round-robin-schedule.ts` |
| Batch calendari multi-lega | `generate-all-league-schedules.ts` + action admin |
| Aprire / chiudere formazioni | `open-matchday-lineups.ts`, `lock-matchday-lineups.ts` (+ `*-all-*.ts`) |
| Auto-carry lineup mancanti | `auto-carry-matchday-lineups.ts` (chiamato dal lock) |
| Eliminare formazione di una squadra | `delete-matchday-lineup.ts` + action admin sulla pagina giornata |
| Penali −2 FP / −1 classifica | `lib/scoring/lineup-penalties.ts` + `calculate-matchday-scores.ts` + `calculate-league-standings.ts` |
| Pubblicare giornata | `lib/server/matchdays/publish-matchday.ts` |
| Classifica | `lib/server/standings/calculate-league-standings.ts`, UI `app/leagues/` |

---

## Rosa e lineup

| Se vuoi… | Tocca |
|----------|-------|
| Regole composizione rosa 25 | `lib/server/rosters/validate-roster-composition.ts` |
| Lock owner a 25 | `lib/server/rosters/roster-edit-policy.ts` |
| Esclusività player in lega | `league-player-exclusivity.ts` + unique Prisma |
| Admin CRUD rosa | `admin-roster-mutations.ts`, UI `app/admin/teams/[teamId]/roster/` |
| Lineup 5+4 validazione | `lib/server/lineups/validate-lineup-composition.ts` |
| Save lineup utente | `app/me/actions.ts` + lib lineups |
| Formazioni random (admin/test) | `generate-random-lineups-for-matchday.ts`, `generate-all-random-lineups.ts` |
| Hub stato formazioni | `app/admin/lineups/` |

---

## Voti e scoring

| Se vuoi… | Tocca |
|----------|-------|
| Parser XLS Fantacalcio | `lib/server/votes/parse-fantacalcio-votes-xls.ts` |
| Import voti lega | `lib/server/votes/import-fantacalcio-votes.ts`, shared `votes/shared.ts` |
| UI pagelle unificate | `app/admin/votes/` (+ `maxDuration`) |
| Lista giocatori richiesti | `lib/server/matchdays/generate-required-vote-players.ts` |
| Fantavoto / bonus-malus | `lib/scoring/calculate-fantavote.ts`, `types.ts` (**Gf+Rf entrambi +3**) |
| Score squadra + auto-sub | `lib/scoring/calculate-team-score.ts` (+ path scores server) |
| Gol da score | `lib/scoring/convert-score-to-goals.ts` |
| Calcolo giornata + risultati fixture | `lib/server/scores/calculate-matchday-scores.ts`, `fixtures/calculate-fantasy-fixture-results.ts` |
| Batch calcola tutto | `lib/server/scores/calculate-all-scores-and-results.ts` |

---

## Torneo

| Se vuoi… | Tocca |
|----------|-------|
| Creare torneo / entries | `create-tournament.ts`, `tournament-entries.ts`, UI `app/admin/tournaments/` |
| Generare bracket / seeding | `generate-tournament-bracket.ts` |
| Apri/chiudi formazioni fase | `open-tournament-round-lineups.ts`, `lock-tournament-round-lineups.ts` |
| Auto-carry lineup torneo | `auto-carry-tournament-round-lineups.ts` |
| Lineup utente torneo | `save-tournament-lineup.ts`, route sotto `app/me/teams/.../tournaments/` |
| Voti XLS torneo | `tournament-votes.ts`, `import-tournament-votes.ts` |
| Calcolo leg + avanzamento | `calculate-tournament-round-results.ts`, `record-tournament-result.ts` |
| Tie admin pick | `pick-tournament-series-winner.ts`, `pending-series-ties.ts` |
| Reset round / a entries | `reset-tournament-round-results.ts`, `reset-tournament-to-entries.ts` |
| Concetto leg andata/ritorno | `tournament-round-leg.ts` |

---

## Catalogo / wipe / reset

| Se vuoi… | Tocca |
|----------|-------|
| Sync/wipe quotazioni | `lib/server/players/sync-fantacalcio-quotazioni-catalog.ts`, UI `app/admin/players/` |
| Parse XLS quotazioni | `parse-fantacalcio-quotazioni.ts` |
| Wipe tornei / leghe | `lib/server/admin/wipe-tournaments.ts`, `wipe-leagues.ts`, zona UI `app/admin/page.tsx` |
| Reset dati lega | `lib/server/admin/reset-league-data.ts` |

---

## Coach / loghi / team

| Se vuoi… | Tocca |
|----------|-------|
| Invite/accept coach | `lib/server/coaches/team-coach-invites.ts`, `app/me/coach-invites/` |
| Accesso team (owner vs coach) | `lib/server/teams/team-access.ts` |
| Upload logo | `lib/server/teams/team-logo.ts`, `next.config.ts` body size, env service role |
| Creare squadra utente | `lib/server/teams/create-user-fantasy-team.ts` |

---

## Infra / deploy

| Se vuoi… | Tocca |
|----------|-------|
| URL pooler / connection limit | `lib/database-url.ts`, `.env.example` |
| Client Prisma runtime | `lib/prisma.ts` |
| Session sticky | `lib/prisma-session.ts` |
| Migrate prod | `scripts/migrate-deploy.mjs`, `DIRECT_URL` |
| Bind healthcheck | `scripts/start-standalone.mjs`, `railway.toml` |
| Image / Prisma CLI isolate | `Dockerfile` (non installare in `/app`) |
| Schema DB | `prisma/schema.prisma` + nuova migration |

---

## Pitfall recenti (dove non ripetere errori)

| Sintomo | Causa tipica | Dove è già mitigato |
|---------|--------------|---------------------|
| Healthcheck Network fail, log Ready | Next bind su HOSTNAME container | `start-standalone.mjs` |
| Crash `validationLevel` post-deploy | npm muta Next in image | Prisma CLI `/opt/prisma-cli` |
| `42P05` | manca `pgbouncer=true` | `database-url.ts` |
| `Transaction not found` | interactive tx lunga su pooler | rewrite write path; no lunghe `$transaction` |
| `EMAXCONNSESSION` preDeploy | `DATABASE_URL` su :5432 o troppi client session | pairing URL + retry migrate |
| `P1001` migrate | Direct IPv6-only | `DIRECT_URL` Session :5432 |
| 413 upload logo | body limit 1mb default | `next.config.ts` 6mb |
| Timeout batch/XLS | proxy ~60s | concurrency, chunk, `maxDuration` |
| Voti non matchano | player source sbagliata / Cod ≠ externalId | catalogo Fantacalcio only |
| Agent “sistema” rosa 8 | doc drift CURSOR_HANDOFF vecchio | ignora; usa `09` + codice |

---

## Entry point actions (ricerca stringa)

- Admin / batch / wipe / torneo / catalogo → `app/admin/actions.ts`  
- User team / rosa / lineup / logo / coach → `app/me/actions.ts`  

Se l’action è un thin wrapper, la logica vera è quasi sempre sotto `lib/server/<dominio>/`.
