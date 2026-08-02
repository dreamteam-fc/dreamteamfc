# Resoconto stato attuale e obiettivi — Fantacalcetto

Documento autocontenuto per handoff a un'altra AI / sessione Cursor.
Data: 2026-08-01.

---

## 1. Contesto in una frase

Fantacalcetto e un'app Next.js gia funzionante (leghe fantasy, rose, formazioni, voti, scoring, calendario, classifica). Gli account infrastrutturali precedenti (Supabase/Railway/Git) sono andati persi: si riparte da zero su infrastruttura nuova, mantenendo il codice locale come fonte di verita, e poi si applicano le regole prodotto "Dream Team FC".

---

## 2. Stack e repo

- **App:** Next.js App Router, TypeScript, Tailwind CSS
- **DB:** PostgreSQL via Prisma 6.19
- **Auth:** Supabase Auth (mapping verso `User` applicativo)
- **Repo locale:** `C:\Users\mailg\fantacalcetto`
- **Remote Git:** `https://github.com/fantacalcettotest/fantacalcetto` (push sospeso: credenziali da fornire dopo)
- **Documentazione handoff:** `docs/CURSOR_HANDOFF/`

### File centrali da conoscere

1. `prisma/schema.prisma`
2. `app/admin/actions.ts`
3. `app/me/actions.ts`
4. `lib/server/public/read-public-league-data.ts`
5. `lib/server/me/read-user-data.ts`
6. `lib/server/admin/read-admin-data.ts`
7. `lib/scoring/*`
8. `docs/CURSOR_HANDOFF/*` (questo pacchetto)

---

## 3. Stato infrastruttura (oggi)

| Voce | Stato |
|------|--------|
| Codice locale | Presente e coerente |
| `node_modules` | Installati |
| Prisma schema | Valido (`prisma validate` OK) |
| `.env` locale | Presente ma **morto**: punta a un progetto Supabase inesistente (`ENOTFOUND tenant/user ... not found`) |
| Nuovo Supabase | **Da creare** |
| Hosting (Railway/Vercel) | Non prioritario: per ora solo locale |
| Git push | Dopo: utente fornira credenziali |

### Cosa NON serve recuperare

- vecchi utenti Supabase Auth
- vecchio database
- vecchio URL Railway
- vecchie chiavi gia perse

### Blocco operativo attuale

Senza un **nuovo progetto Supabase** non si puo:

- migrare il DB
- fare login/signup
- seedare e testare il flusso completo

Variabili da ottenere dal nuovo Supabase e mettere in `.env`:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Opzionali (import giocatori reali):

```env
API_FOOTBALL_KEY=
API_FOOTBALL_SERIE_A_LEAGUE_ID=135
API_FOOTBALL_SEASON=
API_FOOTBALL_REQUEST_DELAY_MS=1500
API_FOOTBALL_MAX_TEAMS_PER_RUN=
API_FOOTBALL_START_TEAM_INDEX=
```

Template: `.env.example`.

---

## 4. Cosa funziona gia nel prodotto (dominio attuale)

### Aree

- **Pubblica:** home, elenco leghe, classifica, calendario, dettaglio giornata pubblicata
- **Utente:** login/signup, join lega, rosa, formazione, area `/me`
- **Admin:** crea leghe, calendario, apre/chiude formazioni, voti, scoring, fixture, pubblica giornata, player globali, reset dati lega

### Regole attuali (prima delle modifiche Dream Team)

**Rosa oggi:** 8 giocatori (min 1P, 2D, 2A; C liberi).

**Formazione oggi:** 5 titolari + 3 panchina (vincoli P/D/A specifici; C liberi).

**Gol da punteggio oggi:** soglia 30, step 5 (`convert-score-to-goals.ts`).

**Ruoli utente oggi:** `USER` e `ADMIN` (super admin globale). Le leghe si creano dall'area admin.

**Gia implementato (Dream Team):** torneo cross-league V1 + voti XLS per fase, account allenatore invitato, password lega, rosa 25 / lineup 5+4, import voti Fantacalcio, `LeagueRole` solo OWNER/MEMBER.

**Non implementato ancora:** asta/mercato, notifiche, storico stagioni.

---

## 5. Decisioni prodotto gia chiuse (2026-08-01)

Queste NON vanno riaperte salvo richiesta esplicita del proprietario.

### 5.1 Rosa = 25

- 3 portieri
- 8 difensori
- 8 centrocampisti
- 6 attaccanti
- Totale **25** (il "22" nel file sorgente Dream Team era un errore)
- Lock owner: a count >= 25 la rosa e congelata (solo Admin modifica); policy in `lib/server/rosters/roster-edit-policy.ts`

### 5.2 "Non giocato" = SV

- Nessun nuovo stato `didNotPlay`
- Si riusa `isSv` e la logica di sostituzione esistente
- Estensioni SV (2026-08-01):
  - giocatore assente dal file voti → SV
  - voto con asterisco (es. `6*`) → SV

### 5.3 Fasce gol nuove

Regola formale:

```text
goals = score <= 25 ? 0 : Math.floor((score - 25) / 2)
```

Esempi:

| Score | Gol |
|-------|-----|
| 25.0  | 0   |
| 26.9  | 0   |
| 27.0  | 1   |
| 28.9  | 1   |
| 29.0  | 2   |
| 31.0  | 3   |

File da aggiornare quando si implementa: `lib/scoring/convert-score-to-goals.ts` + check script + testi UI.

### 5.4 Voti: upload file, eventi, porta inviolata — AGGIORNATO 2026-08-01 sera

Pannello voti: upload **XLS** (esempio `data/voti-fantacalcio-esempio-giornata-38.xlsx`).

Matching: colonna `Cod.` = `externalId` Fantacalcio.

| Codice | Significato | Punti | Note |
|--------|-------------|-------|------|
| `gf` | goal fatto | +3 | |
| `gs` | goal subito | -1 | **solo portieri** |
| `rp` | rigore parato | +3 | |
| `rs` | rigore subito | **TBD** | **solo portieri** |
| `rf` | rigore **fallito** | -3 | = `penaltiesMissed` |
| `au` | autogol | -2 | |
| `amm` | ammonizione | -0.5 | |
| `esp` | espulsione | -1 | |
| `ass` | assist | +1 | |
| porta inviolata | P con `gs=0` (ha giocato) | +1 | automatica |

SV: assente dal file oppure voto con `*`.

Pannello unificato: mostra solo chi ha **effettivamente giocato** dopo le sub.

### 5.5 Admin vede se la formazione e stata messa — NUOVO 2026-08-01

Per ogni squadra/giornata: `INSERITA` / `NON_INSERITA`.

### 5.6 Lega 10 squadre / 18 giornate — DECISO 2026-08-01 sera

- `maxTeams = 10` obbligatorio
- solo modalita **andata e ritorno** → 18 giornate
- dopo la 18ª il campionato e chiuso

### 5.7 Torneo — **FATTO** (V1 + voti XLS)

- admin sceglie **a mano** le squadre (+ lega di provenienza)
- password obbligatoria; seeding alto↔basso; 1ª fase no stessa lega; A/R salvo finale
- voti scoped a `TournamentRound`: genera lista → import XLS Fantacalcio → calcola READY con `convertScoreToGoals`; risultato manuale resta override
- modelli: `TournamentRequiredVotePlayer`, `TournamentPlayerVote`

Vedi dettaglio completo: [09_DECISIONI_PRODOTTO_CHIUSE.md](./09_DECISIONI_PRODOTTO_CHIUSE.md).

### 5.8 Coach invitato — **FATTO**

- invito email → token → accettazione; coach puo solo formare sulla squadra invitante

### 5.9 LeagueRole — **FATTO**

- enum `LeagueRole`: solo `OWNER` | `MEMBER` (`ADMIN` rimosso; membership lega)

### 5.10 UserRole piattaforma — **FATTO**

- enum `UserRole`: `USER` | `MISTER` | `ADMIN` (non confondere con `LeagueRole`)
- Admin assegna ruoli da `/admin`; Mister: voti XLS + ops lega (calendario/giornate/punteggi)
- Deny Mister: tornei, crea leghe, reset, giocatori globali, rose admin, assign ruoli
- Bootstrap: `ADMIN_EMAIL` → promote `ADMIN` al login solo se zero Admin in DB; poi `User.role` è source of truth

---

## 6. Obiettivo complessivo

1. **Bootstrap da zero in locale** su nuovo Supabase
2. **Applicare le regole Dream Team FC** in modo incrementale sul codice esistente (non riscrivere l'app)
3. **Piu avanti:** caricare la repo su Git con le credenziali dell'utente; deploy hosting solo quando richiesto

Principio: niente toppe use-case; soluzioni stabili e riusabili.

---

## 7. Piano di lavoro consigliato

### Fase 0 — Bootstrap locale (prossimo step bloccante)

Quando arrivano le credenziali Supabase:

```bash
# aggiornare .env
npm run prisma:generate
npm run prisma:validate
npx prisma migrate deploy
npm run db:seed
npm run players:import-demo
npm run dev
```

Poi:

1. signup utente
2. `npm run auth:link-admin` (o set manuale `User.authUserId` + `role=ADMIN`)
3. verifica route: `/`, `/signup`, `/login`, `/leagues`, `/me`, `/admin`

Flusso QA minimo: crea lega → join → rosa → calendario → formazioni → voti → punteggi → pubblica.

### Fase 1 — Feature piccole e sicure — **FATTO**

- ~~Password di lega~~ **FATTO**
- ~~Pulizia `LeagueRole.ADMIN`~~ **FATTO** (solo OWNER/MEMBER)
- ~~Pannello voti unificato multi-lega~~ **FATTO**
- ~~Admin: stato formazione inserita / non inserita~~ **FATTO**
- ~~Upload file voti → pagelle~~ **FATTO**

### Fase 2 — Dominio medio — **FATTO**

- ~~Malus goal subito + mappa eventi~~ **FATTO** (`rs`/`rf` chiusi in `09`)
- ~~Formazione 5+4, sub stesso ruolo, rosa 25, fasce gol~~ **FATTO**

### Fase 3 — Epic separati — **FATTO** (V1)

- ~~Campionato chiuso a 18 giornate~~ **FATTO** (maxTeams=10, solo A/R)
- ~~Account allenatore invitato~~ **FATTO**
- ~~Torneo post-campionato~~ **FATTO** (bracket + formazioni + voti XLS per fase)

### Ordine vincolante

Non fare una mega-PR. Non unire torneo + lineup + auth + roster nello stesso task. Riusare servizi esistenti. Dopo ogni task verificare:

```bash
npm run prisma:validate
npm run prisma:generate
npm run check:all
```

---

## 8. Elenco completo richieste Dream Team (mappa)

| # | Richiesta | Stato | Note |
|---|-----------|-------|------|
| 1 | Campionato max 18 giornate | **FATTO** | maxTeams=10, solo A/R |
| 2 | Torneo finale tra leghe | **FATTO** | V1 + voti XLS per `TournamentRound` |
| 3 | Account allenatore invitato | **FATTO** | delega team, sola formazione |
| 4 | Non giocato in voti | **FATTO** | = SV; assente / `*` |
| 5 | Rosa 25 (3/8/8/6) | **FATTO** | |
| 6 | Formazione 5+4 con vincoli ruolo | **FATTO** | |
| 7 | Sub automatiche stesso ruolo | **FATTO** | max 1 |
| 8 | Fasce gol ≤25 / +1 ogni 2 | **FATTO** | `convertScoreToGoals` |
| 9 | Bonus/malus + clean sheet auto | **FATTO** | `rs`/`rf` chiusi in `09` |
| 10 | Solo super admin crea leghe | **FATTO** | `LeagueRole.ADMIN` rimosso |
| 11 | Password di lega | **FATTO** | |
| 12 | Super admin gestisce rose utenti | **FATTO** | add/remove/replace |
| 13 | Pannello voti unificato | **FATTO** | `/admin/votes` |
| 14 | Admin vede se formazione inserita | **FATTO** | |
| 15 | Upload file voti → pagelle | **FATTO** | lega + torneo (per fase) |

Dettaglio analisi: `05_ANALISI_MODIFICHE_DREAM_TEAM_FC.md`.
Dettaglio piano file-per-file: `06_PIANO_APPLICAZIONE_AL_PROGETTO.md`.

---

## 9. Regole operative per l'AI che riceve questo file

```text
Agisci come senior software engineer sul repository corrente.

Contesto:
- Fantacalcetto e gia funzionante: non ripartire da un greenfield applicativo
- Infrastruttura account precedente persa: bootstrap su NUOVO Supabase
- Per ora solo locale; Git push solo su richiesta esplicita con credenziali
- Super admin = User.role ADMIN globale

Decisioni gia chiuse (non riaprire):
- rosa 25 = 3P+8D+8C+6A; titolari 5; panchina 4 (1/ruolo); max 1 sub stesso ruolo
- non giocato = SV (assente da file voti, oppure voto con *)
- gol squadra = score<=25 ? 0 : floor((score-25)/2)
- upload XLS voti; Cod.=externalId Fantacalcio; foglio default Fantacalcio
- eventi: gf+3 ass+1 rp+3 gs-1(solo P) rs(sbagliato)-3 rf(realizzato)0 au-2 amm-0.5 esp-1; clean sheet auto se P gs=0
- leghe 10 squadre, solo A/R = 18 giornate; password obbligatoria; LeagueRole solo OWNER/MEMBER
- torneo V1 fatto: admin sceglie a mano; password; alto vs basso; no stessa lega in 1a fase; voti XLS per fase
- coach invitato fatto (sola formazione)
- leggere anche docs/CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md

Aperti prodotto Dream Team: nessuno.

Regole:
- ispeziona i file reali prima di modificare
- non toccare schema Prisma se non serve al task corrente
- se un requisito e ambiguo, fermati e segnala
- task incrementali e verificabili; niente mega-refactor
- soluzioni stabili, non toppe one-off
- non commit/push se non richiesti esplicitamente
- non stampare segreti (.env) in chat o docs

Alla fine di ogni task: file toccati, impatto dominio, comandi di verifica eseguiti.
```

---

## 10. Prossimo messaggio utile all'utente / all'AI

Appena disponibile il nuovo Supabase, l'utente deve fornire (o aggiornare `.env` con) `DATABASE_URL` + chiavi Supabase. L'AI deve allora eseguire Fase 0 (migrate + seed + demo players + link admin + `npm run dev`) e solo dopo iniziare Fase 1.

Git: non pushare finche l'utente non fornisce credenziali e lo chiede esplicitamente.
