# Checklist Operativa Per Continuare In Cursor

Questa checklist e pensata per quando aprirai il progetto in Cursor e vorrai ripartire subito senza ricostruire il contesto ogni volta.

## A. Primo controllo quando apri il progetto

1. apri `docs/CURSOR_HANDOFF/README.md`
2. verifica `.env` locale
3. apri `prisma/schema.prisma`
4. esegui:

```bash
npm run prisma:generate
npm run prisma:validate
npm run check:all
```

## B. Se stai ripartendo davvero da zero

1. configura nuovo Supabase
2. aggiorna `.env`
3. esegui:

```bash
npx prisma migrate deploy
```

4. scegli bootstrap:

```bash
npm run db:seed
npm run players:import-demo
```

oppure

```bash
npm run players:import-api-football
```

## C. Se vuoi testare il prodotto da browser

Ordine consigliato:

1. signup utente admin o collega admin esistente
2. login admin
3. crea una lega
4. login/signup utente normale
5. join in lega
6. crea rosa
7. genera calendario da admin
8. apri formazioni
9. schiera formazione
10. chiudi formazioni
11. inserisci voti
12. calcola punteggi
13. pubblica giornata

## D. Se qualcosa non funziona, dove guardare prima

### Problema login o signup

Controllare:

- `lib/supabase/config.ts`
- `lib/supabase/server.ts`
- `app/auth/actions.ts`
- variabili Supabase nel `.env`

### Problema permessi admin

Controllare:

- `lib/auth/admin.ts`
- `User.role`
- `User.authUserId`
- `app/admin/layout.tsx`
- `app/admin/actions.ts`

### Problema team/roster/lineup

Controllare:

- `app/me/actions.ts`
- `lib/server/me/read-user-data.ts`
- `lib/server/rosters/validate-roster-composition.ts`
- `lib/server/lineups/validate-lineup-composition.ts`

### Problema voti o punteggi

Controllare:

- `app/admin/actions.ts`
- `lib/server/votes/save-player-vote.ts`
- `lib/server/scores/calculate-matchday-scores.ts`
- `lib/scoring/calculate-fantavote.ts`
- `lib/scoring/calculate-team-score.ts`

### Problema calendario o scontri

Controllare:

- `lib/server/schedules/generate-round-robin-schedule.ts`
- `lib/server/schedules/generate-league-schedule.ts`
- `lib/server/fixtures/generate-fantasy-fixtures.ts`
- `lib/server/fixtures/calculate-fantasy-fixture-results.ts`
- `lib/server/standings/calculate-league-standings.ts`

## E. Se vuoi pulire solo i dati di lega

Esiste gia uno script sicuro:

```bash
npm run db:reset-leagues -- --confirm
```

Cancella:

- leghe
- squadre
- rose
- giornate
- formazioni
- voti
- punteggi
- scontri

Mantiene:

- `User`
- `Player`

## F. Se vuoi importare giocatori reali a blocchi

Usa queste variabili:

- `API_FOOTBALL_REQUEST_DELAY_MS`
- `API_FOOTBALL_MAX_TEAMS_PER_RUN`
- `API_FOOTBALL_START_TEAM_INDEX`

Esempio:

```env
API_FOOTBALL_REQUEST_DELAY_MS=2000
API_FOOTBALL_MAX_TEAMS_PER_RUN=4
API_FOOTBALL_START_TEAM_INDEX=13
```

Poi esegui:

```bash
npm run players:import-api-football
```

## G. Prompt utile da dare a Cursor

Puoi iniziare una nuova sessione con un prompt di questo tipo:

```text
Agisci come senior software engineer sul repository corrente.
Leggi prima:
- docs/CURSOR_HANDOFF/README.md
- docs/CURSOR_HANDOFF/01_RIPARTENZA_DA_ZERO.md
- docs/CURSOR_HANDOFF/02_STATO_ATTUALE_PROGETTO.md
- docs/CURSOR_HANDOFF/03_MAPPA_TECNICA.md
- docs/CURSOR_HANDOFF/04_CHECKLIST_OPERATIVA_CURSOR.md

Poi ispeziona i file coinvolti nel task, non modificare schema o env se non richiesto esplicitamente, e proponi o implementa la modifica nel contesto attuale del progetto Fantacalcetto.
```

## H. File chiave da tenere aperti spesso

- `package.json`
- `.env.example`
- `prisma/schema.prisma`
- `app/admin/actions.ts`
- `app/me/actions.ts`
- `lib/server/admin/read-admin-data.ts`
- `lib/server/me/read-user-data.ts`
- `lib/server/public/read-public-league-data.ts`

## I. Rischi pratici da ricordare

- non usare mai dati admin reali nel frontend
- non usare mai chiavi segrete con prefisso `NEXT_PUBLIC`
- non fare reset del DB se vuoi mantenere `User` e `Player`
- non confondere disattivazione globale player con blocco player per lega
- non aprire iscrizioni dopo generazione calendario senza decisione di prodotto esplicita
