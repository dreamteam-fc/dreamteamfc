# 05 — Regole critiche (DO / DON’T)

Violare queste ha già causato outage o bug di stagione. Leggere prima di Prisma/Docker/votes.

---

## Prisma / Supabase pooler

### DO

- `DATABASE_URL` = Transaction **:6543** + `pgbouncer=true` (runtime)  
- `DIRECT_URL` = Session **:5432** pooler su Railway (migrate; evita Direct IPv6 → P1001)  
- Lasciare `lib/database-url.ts` normalizzare URL  
- Write path pesanti: `createMany` / delete sequenziali / chunk, **non** interactive `$transaction` lunghe  
- `withSessionPrisma` (`lib/prisma-session.ts`) solo dove serve sticky breve  

### DON’T

- Usare Session `:5432` come `DATABASE_URL` in prod → `EMAXCONNSESSION` (Free ~15 slot; app + migrate + `npm run dev` litiga)  
- Usare Transaction `:6543` come `DIRECT_URL` / migrate  
- `connection_limit=1` su Railway long-running → starva server actions concorrenti  
- Riintrodurre `$transaction(async (tx) => { ... })` lunghe su calendario / score / bracket / import voti → `Transaction not found` su PgBouncer  

Sintomi storici: `42P05` prepared statements, `P1001`, `EMAXCONNSESSION`, `Transaction not found`.

---

## Docker / Next pin / Railway

### DO

- Builder = Dockerfile (`railway.toml`)  
- Start = `scripts/start-standalone.mjs` (forza `0.0.0.0`)  
- Prisma CLI in `/opt/prisma-cli` isolata  
- Healthcheck `/api/health` senza DB; timeout 120s  

### DON’T

- `npm install` / `npm ci` contro `/app/package.json` nel runner Docker → Next upgrade → crash `validationLevel` dopo Ready  
- Affidarsi a `ENV HOSTNAME=0.0.0.0` nel Dockerfile (Railway sovrascrive HOSTNAME col nome container)  
- Torna a Nixpacks/Railpack “perché più semplice”  

---

## Dominio prodotto (non “reinterpretare”)

### DO

- Rosa **25** = 3P+8D+8C+6A  
- Lineup **5+4** (panchina 1 per ruolo)  
- Lega **10** squadre, calendario A/R **18** giornate  
- Gol: `score < 25 → 0`, else `1 + floor((score-25)/2)` (da 25 = già 1 gol)  
- Voti: match **`Cod.` = externalId`** sorgente Fantacalcio  
- **Gf / Rf disgiunti e entrambi +3** (`penaltiesScored` entra in `calculate-fantavote`)  
- Formazione mancante: auto-carry `USER|COACH` + penali; altrimenti forfait (vedi `REGOLAMENTO` §4 / `lineup-penalties.ts`)  

### DON’T

- Ripristinare rosa 8 / lineup 5+3 / maxTeams 2–50 da doc drift (`CURSOR_HANDOFF/02_*`, `QA_MANUALE`)  
- Matching voti per **nome** giocatore  
- Trattare `Rf` come “già in Gf” / 0 punti (falso: XLS Fantacalcio li separa)  
- Forfait su ogni lineup mancante senza tentare auto-carry  
- Riattivare player `api-football` / `demo` come fonte voti stagione  
- Assumere cron o mercato: non esistono  

---

## Torneo

### DO

- Formazioni e voti **per fase/leg** (`TournamentRound`, andata/ritorno separati)  
- Finale solo andata  
- Tie residuo → `pick-tournament-series-winner.ts` (intervento umano)  

### DON’T

- Riusare Matchday di lega come fake per voti torneo  
- Calcolare andata+ritorno dallo stesso import XLS senza scope leg  

---

## Auth / ruoli

### DO

- Capacità da `lib/auth/app-roles.ts`  
- `ADMIN_EMAIL` solo bootstrap se zero Admin  
- Platform (wipe, tornei, crea lega, giocatori, random, calendari, calcola/pubblica batch) = `canManagePlatform` (solo ADMIN)  
- Batch **Apri/Chiudi formazioni (tutte)** = `canManageLeagueOps` (ADMIN + MISTER)  
- Assegnazione ruoli `/admin/permessi` = `canAssignAppRoles` (solo admin principale `dreamteamfc@proton.me` / `PRIMARY_ADMIN_EMAIL`, non ogni ADMIN)  
- Mister piattaforma ≠ TeamCoach (badge lineup **MISTER** = coach)  

### DON’T

- Esporre wipe/catalogo a Mister “per comodità” senza decisione prodotto  
- Dare `/admin/permessi` a un ADMIN nominato (resta solo admin principale)  
- Reintrodurre `LeagueRole` admin di lega  

---

## Proxy / batch / upload

### DO

- Batch con concurrency limitata; retry per pezzi se timeout  
- Loghi: Sharp + service role; body Server Actions 6mb (`next.config.ts`)  
- `maxDuration` su route voti pesanti  

### DON’T

- Un unico mega-`$transaction` multi-lega “più pulito”  
- Aspettarsi che un click batch da 20 leghe + XLS grosso stia sempre sotto ~60s proxy  

---

## Docs

### DO

- SoT prodotto: codice + `09_DECISIONI` + questo pack + audit 2026-08-05  

### DON’T

- Usare `CURSOR_HANDOFF/02_STATO_ATTUALE` o `08_*` come spec senza confrontare codice  
