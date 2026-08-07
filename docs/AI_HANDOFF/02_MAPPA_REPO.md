# 02 — Mappa repo

Solo path che contano per un agent. Il resto è rumore o legacy.

## Top-level

```
app/                 # Next App Router (UI + Server Actions entry)
lib/                 # dominio, auth, prisma, scoring
prisma/              # schema + migrations + seed
scripts/             # migrate, start, import, seed, check
docs/                # handoff + audit
data/                # XLS esempio (voti)
components/          # UI condivisa (poche)
supabase/            # config locale se presente
Dockerfile
railway.toml
next.config.ts       # bodyLimit Server Actions 6mb (loghi)
.env.example
```

## `app/` — route

| Path | Chi | Cosa |
|------|-----|------|
| `app/admin/` | Mister+Admin (gate layout); molte subroute **solo Admin** | Ops + platform |
| `app/admin/actions.ts` | — | **Hub** server actions admin/batch/wipe/catalogo/torneo |
| `app/admin/page.tsx` | — | Dashboard: Apri/Chiudi (tutte) per Mister+Admin; altri batch/wipe solo Admin |
| `app/admin/votes/` | Mister+Admin | Pagelle XLS unificate multi-lega |
| `app/admin/lineups/` | Mister+Admin | Hub stato formazioni |
| `app/admin/players/` | Admin | Catalogo quotazioni wipe/sync |
| `app/admin/tournaments/` | Admin | CRUD torneo, entries, bracket |
| `app/admin/permessi/` | Solo admin principale | Assegna USER/MISTER/ADMIN (`canAssignAppRoles`) |
| `app/admin/matchdays/[id]/` | Mister+Admin | Ops giornata |
| `app/admin/teams/[teamId]/roster/` | Admin | CRUD rosa post-lock |
| `app/me/` | User auth; staff vede link Admin | Squadre, rosa, lineup, coach |
| `app/me/actions.ts` | — | Team/rosa/lineup/logo/coach |
| `app/leagues/` | Pubblico + join | Lega, standings, join |
| `app/tournaments/` | Pubblico + activate | Torneo pubblico / entry |
| `app/regolamento/` | Pubblico | Regolamento giocatori |
| `app/come-giocare/` | Pubblico | Guide (lega, formazioni, allenatore, tornei) |
| `app/api/health/` | — | Liveness Railway (no DB) |
| `app/login|signup|forgot-password|reset-password|auth/` | — | Auth Supabase |

## `lib/` — dove vive la logica

| Path | Ruolo |
|------|-------|
| `lib/prisma.ts` | Client runtime (Transaction pooler) |
| `lib/prisma-session.ts` | `withSessionPrisma` — sticky/session quando serve |
| `lib/database-url.ts` | Normalizza URL pooler |
| `lib/auth/app-roles.ts` | Capacità USER/MISTER/ADMIN |
| `lib/auth/admin.ts` | Gate require* |
| `lib/auth/app-user.ts` | Mapping auth → `User` |
| `lib/scoring/*` | Pure: fantavoto (Gf+Rf +3), team score, gol, penali lineup |
| `lib/server/rosters/*` | Validazione 25, lock, esclusività, admin CRUD |
| `lib/server/lineups/*` | Validazione 5+4, open/lock, **auto-carry**, random |
| `lib/server/schedules/*` | Round-robin A/R, batch calendari |
| `lib/server/matchdays/*` | Publish, required votes, status |
| `lib/server/votes/*` | Parse/import XLS Fantacalcio lega |
| `lib/server/scores/*` | Calcolo punteggi giornata (+ batch) |
| `lib/server/fixtures/*` | Fixture fantasy + risultati |
| `lib/server/standings/*` | Classifica |
| `lib/server/tournaments/*` | Bracket, legs, votes, advance, tie pick |
| `lib/server/players/*` | Catalogo sync/wipe Fantacalcio |
| `lib/server/admin/*` | create league, wipe leghe/tornei, reset |
| `lib/server/coaches/*` | Invite/accept coach |
| `lib/server/teams/*` | Create team, logo, access |

## `prisma/`

- `schema.prisma` — modelli + enum (SoT struttura dati)
- `migrations/` — ~25; deploy solo via `scripts/migrate-deploy.mjs` in prod
- `seed.ts` — seed base

## `scripts/` (deploy-critical)

| Script | Perché |
|--------|--------|
| `migrate-deploy.mjs` | preDeploy Railway; retry session pool |
| `start-standalone.mjs` | Force bind `0.0.0.0` |
| `import-fantacalcio-quotazioni.ts` | CLI catalogo |
| `check-all.mjs` | Sanity suite |

## Docs esistenti (pointer)

| Path | Usare per |
|------|-----------|
| `docs/AI_HANDOFF/` | **Questo pack** — mappa agent |
| `docs/ANALISI_STATO_PROGETTO_2026-08-05.md` | Stato, rischi, runbook ops |
| `docs/CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md` | Regole prodotto chiuse |
| `docs/CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md` | Deploy step-by-step |
| `docs/CURSOR_HANDOFF/02_*`, `03_*`, `08_*`, `QA_MANUALE.md` | **Drift** — verificare col codice |
