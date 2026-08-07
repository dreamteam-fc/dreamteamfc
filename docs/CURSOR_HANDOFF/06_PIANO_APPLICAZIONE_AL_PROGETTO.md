# Piano Di Applicazione Al Progetto

> **Storico.** Piano di applicazione iniziale: regole prodotto shipping in [`09_DECISIONI_PRODOTTO_CHIUSE.md`](./09_DECISIONI_PRODOTTO_CHIUSE.md).

Questo documento spiega come trasformare le richieste di `Dream Team FC.txt` in task reali dentro l'architettura attuale di Fantacalcetto.

## Obiettivo

Dare a Cursor istruzioni chiare su:

- cosa cambiare
- in quali file intervenire
- in quale ordine
- quali parti del progetto esistente vanno riusate

## Fase 1 - Decisioni prodotto (BLOCCATE 2026-08-01)

### 1. Composizione rosa reale — DECISA

Rosa da **25** giocatori:

- 3 portieri
- 8 difensori
- 8 centrocampisti
- 6 attaccanti

Totale: 25. Il riferimento a "22" nel file sorgente era un errore.

### 2. Significato di "non giocato" — DECISO

`non giocato = SV`. Nessuno stato nuovo. Si riusa `isSv` e la logica sostituzione gia esistente.

### 3. Fasce gol nuove — DECISA

Regola formale:

- `score <= 25` → 0 gol
- oltre 25: +1 gol ogni 2 punti di fantavoto

Formula:

```text
goals = score <= 25 ? 0 : Math.floor((score - 25) / 2)
```

Esempi:

| Score | Gol |
|-------|-----|
| 25.0  | 0   |
| 25.5  | 0   |
| 26.0  | 0   |
| 27.0  | 1   |
| 28.9  | 1   |
| 29.0  | 2   |
| 31.0  | 3   |

## Fase 2 - Modifiche consigliate per prime

Queste sono le modifiche piu sensate da fare subito, perche si innestano bene sul progetto esistente.

### A. Password di lega

Perche farla presto:

- e indipendente dal torneo
- migliora subito il flusso join
- impatta un'area gia esistente

File/aree da toccare:

- `prisma/schema.prisma`
- `lib/server/teams/create-user-fantasy-team.ts`
- `app/me/actions.ts`
- `app/leagues/[leagueId]/join/page.tsx`
- `app/admin/actions.ts`
- `app/admin/leagues/new/page.tsx`

Approccio corretto:

- aggiungere password hash, non password in chiaro
- il join deve validare la password lato server

### B. Pulizia concetto admin di lega

Perche farla presto:

- il sistema e gia centrato su admin globale
- riduce ambiguita futura

File/aree da rivedere:

- `prisma/schema.prisma`
- riferimenti a `LeagueRole.ADMIN`
- documentazione admin

Approccio corretto (applicato):

- mantenere `User.role = ADMIN` come fonte del super admin
- `LeagueRole.ADMIN` **rimosso**: enum solo `OWNER` | `MEMBER` (migration `20260801230000_tournament_votes_and_drop_league_role_admin`)

### C. Pannello voti unificato multi-lega

Perche farlo presto:

- riusa quasi tutta la logica esistente
- utile subito anche prima di modificare scoring

File/aree da toccare:

- nuovo reader admin in `lib/server/admin/read-admin-data.ts`
- nuova route admin, ad esempio `/admin/votes`
- possibile riuso di `savePlayerVoteAction` e bulk save

Approccio corretto:

- non duplicare la logica voti
- unificare solo la lettura e la UX

### D. Admin: stato formazione inserita — NUOVA

Perche farla presto:

- utile subito in gestione giornata
- riusa `Lineup` esistente

File/aree da toccare:

- `lib/server/admin/read-admin-data.ts`
- `app/admin/matchdays/[matchdayId]/page.tsx` (o vista dedicata)

Approccio corretto:

- per ogni squadra della lega nella giornata: badge `INSERITA` / `MISTER` / `RECUPERATA` / `ADMIN` / `NON INSERITA` (vedi `09`)

### E. Upload file voti → pagelle — NUOVA

Perche farla presto:

- riduce lavoro manuale admin
- formalizza SV da file (assente / asterisco)

File/aree da toccare:

- nuovo parser puro in `lib/server/votes/` (es. `parse-votes-file.ts`)
- action upload in `app/admin/actions.ts`
- UI upload in pannello voti giornata e/o `/admin/votes`
- riuso `savePlayerVote` / bulk + `calculateFantavote`

Regole obbligatorie del parser:

- giocatore assente dal file → SV
- voto con `*` → SV
- eventi: `gf gs rp rs rf au amm esp ass`
- portiere con `gs = 0` → `cleanSheet = 1`

Approccio corretto:

- parser testabile senza UI
- al primo implement: fissare formato file (CSV/XLSX) con esempio reale se disponibile
- non ricostruire il motore punteggi nell'uploader

## Fase 3 - Modifiche di dominio medio-grandi

### A. Nuove regole formazione e panchina

Modifiche richieste:

- panchina da 4
- 1 panchinaro per ruolo
- titolari 1P 1D 1C 1A + 1 slot libero tra D/C/A

File/aree da toccare:

- `lib/server/lineups/validate-lineup-composition.ts`
- `app/me/actions.ts`
- `app/me/teams/[teamId]/matchdays/[matchdayId]/lineup/page.tsx`
- `lib/scoring/calculate-team-score.ts`

Impatto:

- molto alto su UI lineup e scoring

### B. Sostituzioni per stesso ruolo

Modifiche richieste:

- sostituzione solo con panchinaro stesso ruolo
- se manca secondo sostituto di quel ruolo, il secondo resta a 0

File/aree da toccare:

- `lib/scoring/calculate-team-score.ts`
- `lib/scoring/types.ts`
- `scripts/manual-scoring-check.mjs`
- eventuali script di score check

Impatto:

- molto alto sul motore punteggio

### C. Aggiunta malus goal subito + porta inviolata automatica

Modifiche richieste:

- aggiungere `goalsConceded` (`gs`, -1 ciascuno)
- applicare automazione: portiere con `gs = 0` → `cleanSheet = 1` (+1)
- mappare nel pannello/import i codici `gf gs rp rs rf au amm esp ass`
- `rs`/`rf` chiusi in `09`: sbagliato −3 / gol da rigore +3 (additivo a `gf`)

File/aree da toccare:

- `prisma/schema.prisma`
- migration Prisma
- `lib/scoring/calculate-fantavote.ts`
- `lib/scoring/types.ts`
- `app/admin/matchdays/[matchdayId]/votes/page.tsx`
- `app/admin/actions.ts`
- `lib/server/votes/save-player-vote.ts`
- parser file voti (sezione Fase 2.E)

Impatto:

- medio
- pulito e localizzato

## Fase 4 - Modifiche grosse da isolare in epic separati

### A. Account allenatore invitato

Questo va trattato come epic separato.

Motivo:

- tocca auth
- tocca permessi
- tocca ownership della squadra

Approccio consigliato:

- non usare subito un ruolo globale nuovo
- usare delega per team specifico

### B. Campionato limitato a 18 giornate

Questo va trattato come epic separato.

Motivo:

- tocca generazione calendario
- tocca UX admin
- tocca regole di chiusura stagione

Approccio consigliato:

- introdurre una regola di stagione o di lega esplicita
- decidere se 18 e fisso o configurabile

### C. Torneo post-campionato tra leghe

Questo va trattato come macro-feature separata.

Motivo:

- e un nuovo dominio, non un semplice tweak
- richiede bracket/eliminazione diretta/seeding/password torneo

Approccio consigliato:

- non innestarlo dentro `League` e `Matchday` esistenti senza un modello dedicato
- creare nuove entita e nuovi servizi

## Ordine di implementazione consigliato per Cursor

### Step 1 — FATTO (2026-08-01)

- requisiti incoerenti chiariti e documentati
- bootstrap locale: in attesa nuovo progetto Supabase (account precedenti persi)

### Step 2

- password lega
- pulizia super admin vs admin di lega
- pannello voti unificato
- admin: stato formazione inserita/mancante
- upload file voti (SV se assente o con `*`; eventi bonus/malus; clean sheet auto)

### Step 3

- nuovo malus goal subito
- nuova lineup con panchina da 4
- sostituzioni stesso ruolo

### Step 4

- campionato chiuso a 18 giornate

### Step 5

- account allenatore

### Step 6

- torneo finale tra leghe

## Regole per Cursor mentre implementa

- non fare una mega PR concettuale
- non unire torneo, lineup, auth e roster nello stesso task
- riusare i servizi esistenti prima di crearne di nuovi
- mantenere le verifiche con:

```bash
npm run prisma:validate
npm run prisma:generate
npm run check:all
```

- se una modifica richiede nuove migration, crearle solo per il task specifico
