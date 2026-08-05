# 01 — Stack e deploy

## Stack

| Layer | Scelta | Note |
|-------|--------|------|
| App | Next.js **16.2.9** App Router | Pin esatto; React 19, TS, Tailwind 3 |
| Runtime | Node **`>=22 <23`**, npm **`>=11 <12`** | `package.json` `engines` / `.nvmrc` |
| DB | PostgreSQL (Supabase) + Prisma **6.19** | Schema in `prisma/schema.prisma` |
| Auth | Supabase Auth (`@supabase/ssr`) | Mapping `User.authUserId` |
| Storage | Supabase Storage bucket `team-logos` | Serve `SUPABASE_SERVICE_ROLE_KEY` |
| Hosting | **Railway** via **Dockerfile** | Non Nixpacks (`railway.toml`) |
| XLS | `xlsx` | Quotazioni + voti Fantacalcio |

## Env critiche

Fonte commentata: `.env.example`.

| Var | Uso |
|-----|-----|
| `DATABASE_URL` | Runtime app → Transaction pooler **:6543** + `pgbouncer=true` |
| `DIRECT_URL` | Migrate / rare sticky tx → Session pooler **:5432** (IPv4 Railway) |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth/client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth/client (fallback: `ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload loghi (server-only) |
| `ADMIN_EMAIL` | Bootstrap **solo** se zero Admin in DB; poi DB è SoT |
| `NEXT_PUBLIC_APP_URL` | Opzionale; invite coach / redirect |

Normalizzazione URL: `lib/database-url.ts` (aggiunge `pgbouncer=true` su `:6543`; `connection_limit≈5` su host long-running — **non** `1`).

## Deploy Railway (flusso)

File: `railway.toml`, `Dockerfile`, `scripts/migrate-deploy.mjs`, `scripts/start-standalone.mjs`.

1. **Build** Docker multi-stage (`node:22-bookworm-slim`)  
2. **preDeploy** `node scripts/migrate-deploy.mjs` (retry su `EMAXCONNSESSION`)  
3. **start** `node scripts/start-standalone.mjs` → forza `HOSTNAME=0.0.0.0`  
4. **healthcheck** `GET /api/health` (no DB), timeout **120s**

### Dockerfile — cose da non “semplificare”

- Prisma CLI isolata in `/opt/prisma-cli` — **mai** `npm install` contro `/app/package.json` nel runner (upgrada Next → crash `validationLevel`).
- OpenSSL su slim per Prisma.
- Start wrapper, non `node server.js` grezzo.

## Comandi locali utili

```bash
npm run dev
npm run build
npm run db:migrate:deploy
npm run players:import-fantacalcio
npm run check:all
```

Seed/test: `db:seed`, `db:seed-test-league`, `db:seed-multi-test-leagues`, `db:reset-leagues`.

## Guida lunga

Dettaglio infra: [`../CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md`](../CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md)  
Checklist: [`../DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md)  
Audit + runbook settimana: [`../ANALISI_STATO_PROGETTO_2026-08-05.md`](../ANALISI_STATO_PROGETTO_2026-08-05.md) §6.
