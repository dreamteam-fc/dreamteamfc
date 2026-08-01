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

**Non implementato ancora:** asta/mercato, notifiche, torneo cross-league, account allenatore, storico stagioni.

---

## 5. Decisioni prodotto gia chiuse (2026-08-01)

Queste NON vanno riaperte salvo richiesta esplicita del proprietario.

### 5.1 Rosa = 25

- 3 portieri
- 8 difensori
- 8 centrocampisti
- 6 attaccanti
- Totale **25** (il "22" nel file sorgente Dream Team era un errore)

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

### 5.7 Torneo — DECISO (dettaglio)

- admin sceglie **a mano** le squadre (+ lega di provenienza)
- password obbligatoria; seeding alto↔basso; 1ª fase no stessa lega; A/R salvo finale

Vedi dettaglio completo: [09_DECISIONI_PRODOTTO_CHIUSE.md](./09_DECISIONI_PRODOTTO_CHIUSE.md).

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

### Fase 1 — Feature piccole e sicure

- Password di lega (hash server-side, mai in chiaro)
- Pulizia concetto admin di lega (`LeagueRole.ADMIN` vs super admin globale)
- Pannello voti unificato multi-lega (UI/reader; riusare `savePlayerVote`)
- Admin: stato formazione inserita / non inserita per giornata
- Upload file voti → pagelle (SV se assente o con `*`; eventi `gf/gs/rp/...`; clean sheet auto)

### Fase 2 — Dominio medio

- Malus **goal subito** (`goalsConceded`, -1) + mappa eventi completa — schema + scoring + UI voti
- Chiarire punti `rs` / `rf` se distinti
- Nuova formazione: 5 titolari (1P 1D 1C 1A + 1 libero D/C/A) + **panchina da 4** (1 per ruolo)
- Sostituzioni automatiche **solo stesso ruolo**
- Rosa da 25 con vincoli ruolo
- Nuove fasce gol (formula sopra)

### Fase 3 — Epic separati (non mischiare con Fase 1/2)

- Campionato chiuso a **18 giornate**
- Account **allenatore invitato** (delega per team, non ruolo globale)
- **Torneo** post-campionato cross-league (nuovo dominio: Tournament / Round / Fixture, non forzarlo dentro League)

### Ordine vincolante

Non fare una mega-PR. Non unire torneo + lineup + auth + roster nello stesso task. Riusare servizi esistenti. Dopo ogni task verificare:

```bash
npm run prisma:validate
npm run prisma:generate
npm run check:all
```

---

## 8. Elenco completo richieste Dream Team (mappa)

| # | Richiesta | Stato decisione | Priorita |
|---|-----------|-----------------|----------|
| 1 | Campionato max 18 giornate | Da implementare | Epic Fase 3 |
| 2 | Torneo finale tra leghe | Da implementare (nuovo dominio) | Epic Fase 3 |
| 3 | Account allenatore invitato | Da implementare (delega) | Epic Fase 3 |
| 4 | Non giocato in voti | = SV; anche assente da file / voto con `*` | Fase 1 (import) |
| 5 | Rosa 25 (3/8/8/6) | Deciso | Fase 2 |
| 6 | Formazione 5+4 con vincoli ruolo | Deciso | Fase 2 |
| 7 | Sub automatiche stesso ruolo | Deciso | Fase 2 |
| 8 | Fasce gol ≤25 / +1 ogni 2 | Deciso | Fase 2 |
| 9 | Bonus/malus `gf gs rp rs rf au amm esp ass` + clean sheet auto | Quasi allineati; manca `gs`; `rs`/`rf` TBD | Fase 1–2 |
| 10 | Solo super admin crea leghe | Gia vicino; pulizia modello | Fase 1 |
| 11 | Password di lega | Da implementare | Fase 1 |
| 12 | Super admin gestisce rose utenti | Da implementare | Dopo regole rosa |
| 13 | Pannello voti unificato | Da implementare | Fase 1 |
| 14 | Admin vede se formazione inserita | Deciso | Fase 1 |
| 15 | Upload file voti → pagelle | Deciso (formato file da fissare al primo implement) | Fase 1 |

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
- eventi: gf+3 ass+1 rp+3 gs-1(solo P) rf(fallito)-3 au-2 amm-0.5 esp-1; clean sheet auto se P gs=0
- leghe 10 squadre, solo A/R = 18 giornate; password obbligatoria; no admin di lega
- torneo: admin sceglie a mano; password; alto vs basso; no stessa lega in 1a fase
- leggere anche docs/CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md

Aperti:
- punti esatti di rs (rigore subito, solo P)
- Rs su non-portieri nel file XLS: ignorare?

Regole:
- ispeziona i file reali prima di modificare
- non toccare schema Prisma se non serve al task corrente
- se un requisito e ambiguo, fermati e segnala
- task incrementali e verificabili; niente mega-refactor
- torneo e coach = epic separati
- soluzioni stabili, non toppe one-off
- non commit/push se non richiesti esplicitamente
- non stampare segreti (.env) in chat o docs

Alla fine di ogni task: file toccati, impatto dominio, comandi di verifica eseguiti.
```

---

## 10. Prossimo messaggio utile all'utente / all'AI

Appena disponibile il nuovo Supabase, l'utente deve fornire (o aggiornare `.env` con) `DATABASE_URL` + chiavi Supabase. L'AI deve allora eseguire Fase 0 (migrate + seed + demo players + link admin + `npm run dev`) e solo dopo iniziare Fase 1.

Git: non pushare finche l'utente non fornisce credenziali e lo chiede esplicitamente.
