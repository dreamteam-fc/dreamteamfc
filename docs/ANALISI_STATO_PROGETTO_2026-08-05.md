# Analisi stato progetto — Fantacalcetto / Dream Team FC

**Data:** 2026-08-05  
**Repo:** `C:\Users\mailg\fantacalcetto` → `https://github.com/dreamteam-fc/dreamteamfc.git` (`main`)  
**HEAD al momento dell’audit:** `3f945f3` — *feat(admin): catalogo quotazioni con wipe/sync e mitiga rischi residuali*  
**Working tree:** pulito (nessun file dirty/untracked al momento della scrittura)

Questo documento è un audit onesto, non un pitch. Fonti: codice (`app/`, `lib/server/`, `prisma/`), deploy (`Dockerfile`, `railway.toml`, `scripts/`), decisioni prodotto (`docs/CURSOR_HANDOFF/09_*`), e commit recenti su tornei/batch/deploy.

---

## 1. Product status — cosa funziona E2E

### 1.1 Campionato di lega (operatore-driven)

Flusso completo implementato e usabile:

1. Admin crea lega (password obbligatoria, `maxTeams=10`, calendario A/R → 18 giornate)
2. Utenti join + creano squadra + costruiscono rosa 25 (3P+8D+8C+6A)
3. Admin genera calendario round-robin A/R
4. Apertura/chiusura formazioni (per giornata o batch multi-lega)
5. Utenti (o coach invitati) inseriscono lineup 5+4
6. Generazione lista voti → upload XLS Fantacalcio → calcolo punteggi → risultati fixture → pubblicazione
7. Classifica pubblica da fixture pubblicate

Regole prodotto attive nel codice (non solo nei doc):

| Area | Valore | Dove |
|------|--------|------|
| Rosa | 25 = 3P+8D+8C+6A | `lib/server/rosters/validate-roster-composition.ts` |
| Lock rosa owner | a count ≥ 25 solo Admin modifica | `lib/server/rosters/roster-edit-policy.ts` |
| Esclusività | stesso player non in due rose della stessa lega | `FantasyRoster @@unique([leagueId, playerId])` |
| Lineup | 5 titolari + 4 panchina (1 per ruolo) | `lib/server/lineups/validate-lineup-composition.ts` |
| Sub auto | max 1 per ruolo (max 4) | `League.maxAutoSubs` default 4 |
| Gol da score | `score ≤ 25 → 0`, altrimenti `floor((score-25)/2)` | `lib/scoring/convert-score-to-goals.ts` |
| Voti | XLS Fantacalcio, match `Cod.` = `externalId` | `lib/server/votes/*` |

**Batch admin multi-lega** (dashboard `/admin`, solo Admin): genera calendari, genera formazioni casuali, apri/chiudi formazioni, calcola punteggi+risultati, pubblica giornate. Pagelle unificate su `/admin/votes` (Admin + Mister).

### 1.2 Torneo cross-league

V1 + voti XLS **chiuso e operativo**:

- Creazione torneo, entries manuali (squadra + lega), password, seeding alto↔basso
- Bracket 4/8/16/32/64; A/R salvo finale; no stessa lega in 1ª fase
- Lifecycle formazioni per fase (`TournamentRound.lineupsStatus`: DRAFT → OPEN → LOCKED)
- Voti XLS scoped a round/leg (andata/ritorno separati)
- Calcolo leg-by-leg + avanzamento serie
- Pareggio aggregato → seed migliore; admin pick su tie residui (`pick-tournament-series-winner.ts`)
- Reset round / reset a entries; formazioni random admin

Route chiave: `/admin/tournaments/*`, `/tournaments/*`, lineup utente su `/me/teams/[teamId]/tournaments/fixtures/.../lineup`.

### 1.3 Catalogo giocatori

- Sorgente canonica stagionale: **Fantacalcio quotazioni** (`source = fantacalcio-quotazioni`, `externalId` = Cod.)
- UI admin `/admin/players`: filtri source/status/ruolo, deactivate/reactivate
- Upload catalogo: mode **WIPE** solo se leghe=0 e tornei=0; altrimenti **SYNC** (upsert per externalId, disattiva/cancella altre sorgenti senza riferimenti)
- Fine anno: WIPE TORNEO → WIPE LEGHE → upload lista (`app/admin/page.tsx` zona pericolosa)
- Script CLI: `npm run players:import-fantacalcio`
- API-Football / demo restano come script legacy (`players:import-api-football`, `players:import-demo`); in sync season vengono disattivati/rimossi se non referenziati

### 1.4 Auth e ruoli

- Supabase Auth → mapping `User.authUserId` (`lib/auth/app-user.ts`)
- Login / signup / forgot / reset password
- Bootstrap Admin: `ADMIN_EMAIL` promuove solo se non esiste già alcun Admin; poi DB è source of truth
- `UserRole`: `USER` | `MISTER` | `ADMIN` (`lib/auth/app-roles.ts`)
- Assegnazione ruoli: `/admin/permessi` (solo Admin)
- `LeagueRole`: solo `OWNER` | `MEMBER` (niente admin di lega)

| Capacità | USER | MISTER | ADMIN |
|----------|------|--------|-------|
| Area `/admin` | no | sì (ops) | sì |
| Pagelle XLS / voti / score giornata | no | sì | sì |
| Batch multi-lega dashboard | no | no | sì |
| CRUD rose admin, giocatori globali, wipe | no | no | sì |
| Tornei, crea leghe, permessi | no | no | sì |

### 1.5 Coach (allenatore invitato)

- Invito email → token → accettazione (`TeamCoachInvite` / `TeamCoach`)
- Coach: solo formazione della squadra invitante (lega + torneo)
- UI: `/me/teams/[teamId]` + `/me/coach-invites/[token]`
- **Non** modifica rosa

### 1.6 Loghi squadra

- Upload WebP via Sharp + Supabase Storage (`team-logos`), richiede `SUPABASE_SERVICE_ROLE_KEY`
- Limite body Server Action alzato a 6mb in `next.config.ts` (default Next 1mb → 413 opachi)
- Path su `FantasyTeam.logoPath`

### 1.7 Cosa non c’è (perimetro esplicito)

- Asta / mercato trasferimenti
- Notifiche push/email automatiche (oltre invite coach)
- Storico stagioni archiviate come prodotto
- Automazione cron (apri/chiudi giornata da sola): tutto è click admin
- Multi-admin sofisticato oltre USER/MISTER/ADMIN

---

## 2. Architecture

### 2.1 Stack

| Layer | Scelta |
|-------|--------|
| App | Next.js **16.2.9** App Router, React 19, TypeScript, Tailwind 3 |
| DB | PostgreSQL (Supabase) + Prisma **6.19** |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Hosting | Railway (Docker, non Nixpacks) |
| Node | `>=22 <23` |

### 2.2 Struttura app

```
app/
  admin/          # staff (Mister|Admin) + platform (Admin)
  me/             # utente autenticato (rosa, lineup, coach, torneo)
  leagues/        # pubblico + join
  tournaments/    # pubblico + activate entry
  api/health/     # liveness Railway (no DB)
  login|signup|forgot-password|reset-password|auth/
lib/
  auth/           # gate ruoli
  scoring/        # pure functions
  server/         # use case dominio (leghe, tornei, voti, wipe, …)
  prisma.ts       # client runtime (Transaction pooler)
  prisma-session.ts / database-url.ts  # mitigazioni PgBouncer
prisma/           # schema + migrations (~25)
scripts/          # migrate, start, seed, import, check
docs/CURSOR_HANDOFF/  # handoff (parzialmente drift)
```

Server Actions centrali:

- `app/admin/actions.ts` — ops lega/torneo/batch/wipe/catalogo
- `app/me/actions.ts` — team, rosa, lineup, logo, coach

### 2.3 Prisma / Supabase URL (pairing stabile)

Documentato in `.env.example`, `prisma/schema.prisma`, `scripts/migrate-deploy.mjs`:

| Var | Uso | Porta tipica |
|-----|-----|--------------|
| `DATABASE_URL` | runtime app | Transaction pooler **:6543** + `pgbouncer=true` |
| `DIRECT_URL` | migrate + rare sticky tx | Session pooler **:5432** (Railway IPv4; Direct `db.*.supabase.co` spesso IPv6-only → P1001) |

Normalizzazione runtime: `lib/database-url.ts`

- aggiunge `pgbouncer=true` se manca su `:6543` (evita `42P05`)
- su host long-running (Railway) default `connection_limit≈5` (non `1`, che starva le server action concorrenti)
- `withSessionPrisma` per tx interattive brevi quando il runtime è su Transaction mode

Pattern stabile nei write path pesanti: **evitare** `$transaction` interattive lunghe; usare `createMany` / delete sequenziali (calendario, score calc, reset, bracket, voti).

### 2.4 Deploy Railway

`railway.toml`:

- build: `Dockerfile`
- preDeploy: `node scripts/migrate-deploy.mjs` (retry su EMAXCONNSESSION)
- start: `node scripts/start-standalone.mjs` (forza `HOSTNAME=0.0.0.0`)
- healthcheck: `/api/health`, timeout **120s**

`Dockerfile` critici già assorbiti:

1. Prisma CLI isolata in `/opt/prisma-cli` — evita `npm install` che upgrada Next nello standalone → crash `validationLevel`
2. OpenSSL su slim per Prisma
3. Start wrapper contro HOSTNAME container Railway

---

## 3. Bug irrisolti / rischi noti

### 3.1 Mitigati ma da non riaprire

| Rischio | Sintomo storico | Mitigazione |
|---------|-----------------|-------------|
| Healthcheck Railway | Ready ma Network fail | `start-standalone.mjs` forza `0.0.0.0` |
| Next pin in image | crash post-Ready `validationLevel` | Prisma CLI isolata, no mutate `/app` |
| Prepared statements | `42P05` | `pgbouncer=true` + normalizer |
| Tx interattive su pooler | `Transaction not found` | rewrite write path; `withSessionPrisma` solo dove serve |
| Session pool pieno | `EMAXCONNSESSION` preDeploy | `DATABASE_URL=:6543`, `DIRECT_URL=:5432`; retry migrate; chicken-egg escape in hint script |
| Proxy ~60s | batch multi-lega / import XLS | concurrency limitata, revalidate leggera, `maxDuration=300` su `/admin/votes` |
| Logo upload | 413 / errore opaco | body limit 6mb + service role |

### 3.2 Rischi residuali (ancora veri)

1. **Timeout proxy su batch grossi** — con molte leghe + XLS pesante, un singolo click può ancora superare la finestra proxy Railway anche con concurrency 3. Non c’è job queue.
2. **Session pool Free (~15 slot)** — `withSessionPrisma` e migrate condividono `:5432`; `npm run dev` locale + prod possono esaurirlo. Mitigato, non eliminato.
3. **Mister vs Admin UI** — Mister vede dashboard “operativa” ma i bottoni batch multi-lega sono nascosti (`canManagePlatform`). Può lavorare giornata-per-giornata / pagelle unificate; facile confondersi se i doc dicono “Mister = ops complete”.
4. **Docs drift** — `02_STATO_ATTUALE` e pezzi di `08_*` / `QA_MANUALE` descrivono ancora rosa 8, lineup 5+3, solo ruolo ADMIN, maxTeams 2–50. La verità prodotto è `09_DECISIONI` + codice.
5. **Sorgenti player miste** — sync disattiva api-football/demo, ma filtri UI e script legacy restano; rischio confusione matching voti se qualcuno riattiva giocatori sbagliati.
6. **Nessuna automazione settimanale** — se l’operatore dimentica un passo (chiudi formazioni / pubblica), la giornata resta ferma. By design oggi, ma rischio operativo.
7. **Torneo tie admin-pick** — edge case raro ma richiede intervento umano consapevole.
8. **Supabase Storage bucket** — loghi dipendono da bucket/policy configurati a mano; senza service role l’upload fallisce.

### 3.3 Incomplete / deferred di prodotto

- Mercato/asta: non in scope codice
- Notifiche: no
- Storico stagioni: wipe fine anno è il percorso attuale (distruttivo, non archivio)
- Onboarding UX mister/owner: funzionale ma grezza

---

## 4. Da finire / lucidare

| Tema | Nota |
|------|------|
| **UI gaps** | Dashboard ricca di form batch; hub formazioni esiste (`/admin/lineups`) ma UX non “season console” unificata. Pubblico ok ma non brand-polished ovunque. |
| **Mister vs Admin** | Allineare copy/help in UI: cosa può fare Mister in una settimana tipica senza Admin. Eventuale esporre alcuni batch “safe” anche a Mister. |
| **Mercato** | Deciso deferred; senza di esso le rose restano fisse post-lock (solo Admin CRUD). |
| **Automation** | Cron o “wizard giornata N” (apri → reminder → chiudi → importa → calcola → pubblica) ridurrebbe errori umani. |
| **Docs** | Aggiornare o marcare obsoleti `02_*`, `03_*` (lineup 5+3), `QA_MANUALE` (maxTeams, ruoli), README handoff remote GitHub vecchio. |
| **Script** | Catalogo ora anche da UI; CLI `import-fantacalcio-quotazioni` allineato. Script API-Football: tenere come legacy esplicito o deprecare in package.json. |
| **Leftover sources policy** | Documentare policy ufficiale: canonico = `fantacalcio-quotazioni`; altre sorgenti = inactive o delete-if-unref; matching voti solo su Cod. Fantacalcio. |
| **Fine anno** | Flusso wipe documentato in UI; manca checklist ops dedicata in docs (oltre a questa sezione 6). |

---

## 5. Miglioramenti importanti (priorità)

### P0 — stabilità stagione live

1. **Hardening ops batch** — se si scalano molte leghe: spezzare batch in job per-lega con progresso, o endpoint chunked, per non dipendere dal proxy 60s.
2. **Checklist env produzione** — verificare su Railway: `DATABASE_URL` :6543+pgbouncer, `DIRECT_URL` :5432, chiavi Supabase, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` solo bootstrap, Site URL/redirect.
3. **Sanare docs operative** — una sola “fonte di verità” ops (questo file + `09_DECISIONI` + `GUIDA_DEPLOY_RAILWAY`); evitare che un futuro agente ripristini regole rosa 8.

### P1 — riduzione carico operatore

4. **Wizard “Giornata N”** — un’unica pagina che guida i passi in ordine con stato per lega (formazioni aperte? voti completi? pubblicata?).
5. **Mister: permessi batch letti** — decidere se Mister può apri/chiudi/calcola/pubblica multi-lega o resta per-giornata; oggi mismatch aspettativa vs UI.
6. **Policy catalogo in UI** — banner chiaro: sorgente canonica, cosa fa SYNC vs WIPE, avviso su player non-Fantacalcio attivi.

### P2 — prodotto futuro

7. Mercato/asta (se richiesto dalla stagione)
8. Archivio stagione (snapshot) invece di solo wipe
9. Notifiche (chiusura formazioni, pubblicazione)
10. Polish UI pubblica / brand

---

## 6. Ops runbook — una settimana senza toccare codice

Prerequisiti: leghe create, 10 squadre, rose complete (o Admin che completa), calendario generato, catalogo Fantacalcio caricato, Mister o Admin loggato.

### Prima della giornata Serie A (o del turn fantasy)

1. `/admin` → (Admin) **Apri formazioni** batch, oppure per ogni lega apri la next matchday  
2. Comunicare ai mister/owner: deadline formazioni  
3. Opzionale: Hub formazioni `/admin/lineups` per vedere chi ha inserito / rose incomplete  
4. Opzionale stress/test: **Genera formazioni** random (solo Admin) per squadre senza lineup

### Dopo deadline formazioni

5. **Chiudi formazioni** (batch o per giornata)  
6. `/admin/votes` → seleziona numero giornata → genera liste se serve → **upload XLS** Fantacalcio (fan-out multi-lega)  
7. Verifica errori per lega nel notice  
8. **Calcola punteggi e risultati** (batch Admin, o per matchday)  
9. Controlla punteggi su `/admin/matchdays/[id]/scores`  
10. **Pubblica giornate**  
11. Verifica classifica pubblica `/leagues/[id]/standings`

### Torneo (quando attivo)

Su `/admin/tournaments/[id]/bracket`, per fase/leg:

1. Apri formazioni → utenti schierano → chiudi  
2. Genera lista voti → XLS (andata/ritorno separati) → calcola  
3. Se serie in pareggio senza winner automatico → admin pick  
4. Avanza alla fase successiva

### Fine stagione / reset catalogo

1. Digita `WIPE TORNEO` su `/admin`  
2. Digita `WIPE LEGHE`  
3. `/admin/players` → upload XLS quotazioni (mode WIPE solo a catalogo vuoto di riferimenti)  
4. Ricrea leghe / invita utenti

### Se il deploy fallisce

- Pre-deploy P1001 → `DIRECT_URL` Session pooler, non Direct IPv6  
- EMAXCONNSESSION → pairing URL; stop `npm run dev`; eventuale disable temporaneo preDeploy (hint in `migrate-deploy.mjs`)  
- Healthcheck fail con Ready in log → verificare che parta `start-standalone.mjs`, non `node server.js` grezzo  

Dettaglio infrastruttura: `docs/CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md`.

---

## 7. Verdict

**Sì — production-ready per una stagione operator-driven**, con caveat chiari.

L’app non è più un MVP vuoto: campionato 18 giornate, scoring Fantacalcio, batch multi-lega, torneo con voti, coach, loghi, ruoli Mister/Admin, catalogo quotazioni con wipe/sync, e deploy Railway indurito contro i failure mode già incontrati (hostname, Next pin, pooler, migrate).

**Caveat obbligatori:**

1. Serve un **operatore competente** (Admin o Mister+Admin) ogni turno: niente cron.
2. Config URL Supabase **sbagliata** rompe migrate o runtime in modi già visti (documentati, non “magici”).
3. Batch su proxy può ancora fallire sotto carico estremo — riprovare per pezzi.
4. **Niente mercato**: rose post-lock solo via Admin.
5. Documentazione handoff **parzialmente obsoleta** — non usarla come spec senza confrontare codice / `09_DECISIONI` / questo audit.
6. Working tree al momento dell’audit: **pulito** su `main` allineato a `origin/main`.

Per una lega (o poche leghe) gestita a mano con file voti Fantacalcio settimanali: **idoneo**. Per “piattaforma self-serve senza operatore” o “asta completa”: **non ancora**.

---

## Appendice A — File ancora centrali

1. `prisma/schema.prisma`
2. `app/admin/actions.ts` / `app/me/actions.ts`
3. `lib/auth/app-roles.ts` / `lib/auth/admin.ts`
4. `lib/database-url.ts` / `lib/prisma.ts` / `lib/prisma-session.ts`
5. `lib/server/players/sync-fantacalcio-quotazioni-catalog.ts`
6. `lib/server/votes/*` + `lib/server/tournaments/*`
7. `lib/scoring/*`
8. `railway.toml` / `Dockerfile` / `scripts/migrate-deploy.mjs` / `scripts/start-standalone.mjs`
9. `docs/CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md`
10. `docs/CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md`

## Appendice B — Git (snapshot audit)

```
branch: main → origin/main
HEAD:   3f945f3
remote: https://github.com/dreamteam-fc/dreamteamfc.git
status: clean
```

Commit recenti rilevanti: catalogo wipe/sync; tornei (legs, tiebreak, formazioni); deploy healthcheck + Prisma CLI isolate; batch admin multi-lega; pagelle unificate proxy-safe.
