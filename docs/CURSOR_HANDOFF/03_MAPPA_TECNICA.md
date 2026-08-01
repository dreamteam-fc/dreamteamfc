# Mappa Tecnica

Questa pagina riassume come e organizzato il codice oggi.

## Cartelle principali

### `app/`

Contiene route Next.js App Router.

- `app/page.tsx`: homepage pubblica
- `app/login`, `app/signup`, `app/forgot-password`, `app/reset-password`: auth UI
- `app/leagues/*`: area pubblica leghe
- `app/me/*`: area utente autenticata
- `app/admin/*`: area admin protetta

### `lib/`

Contiene logica condivisa.

- `lib/prisma.ts`: singleton PrismaClient
- `lib/auth/*`: controllo auth utente e admin
- `lib/supabase/*`: helper Supabase server/client
- `lib/scoring/*`: funzioni pure di scoring
- `lib/server/*`: use case server-side per dominio applicativo

### `prisma/`

- `schema.prisma`: schema completo del database
- `migrations/`: migration Prisma
- `seed.ts`: seed demo

### `scripts/`

Script terminali per test e bootstrap.

## Servizi principali gia presenti

### Auth

- `lib/auth/app-user.ts`
- `lib/auth/admin.ts`

Uso:

- autenticazione utente applicativo
- mapping Supabase user -> User applicativo
- protezione area admin

### Team e join lega

- `lib/server/teams/create-user-fantasy-team.ts`
- `lib/server/leagues/has-league-schedule-generated.ts`

Uso:

- creazione squadra utente
- blocco iscrizioni dopo generazione calendario

### Rosa

- `lib/server/rosters/validate-roster-composition.ts`
- action in `app/me/actions.ts`

Uso:

- validazione composizione rosa
- add/remove player
- blocco player inattivi o bloccati nella lega

### Formazione

- `lib/server/lineups/validate-lineup-composition.ts`
- action in `app/me/actions.ts`

Uso:

- validazione 5 titolari + 3 panchina
- controllo ownership team
- controllo stato giornata `LINEUPS_OPEN`

### Voti admin

- `lib/server/matchdays/generate-required-vote-players.ts`
- `lib/server/votes/save-player-vote.ts`
- `lib/server/matchdays/check-votes-completion.ts`

Uso:

- generazione lista giocatori utili
- salvataggio voto singolo o bulk
- completion check

### Scoring

- `lib/scoring/calculate-fantavote.ts`
- `lib/scoring/calculate-team-score.ts`
- `lib/server/scores/calculate-matchday-scores.ts`

Uso:

- formula fantavoto
- sostituzioni automatiche
- persistenza `TeamScore` e `TeamScorePlayer`

### Fixture e classifica

- `lib/scoring/convert-score-to-goals.ts`
- `lib/server/fixtures/generate-fantasy-fixtures.ts`
- `lib/server/fixtures/calculate-fantasy-fixture-results.ts`
- `lib/server/standings/calculate-league-standings.ts`

Uso:

- accoppiamenti giornata
- risultato fantasy
- tavolino
- classifica

### Calendario round-robin

- `lib/server/schedules/generate-round-robin-schedule.ts`
- `lib/server/schedules/generate-league-schedule.ts`

Uso:

- calendario solo andata
- calendario andata e ritorno
- supporto squadre dispari con turno di riposo

### Player management

- `lib/server/players/import-player-list.ts`
- `lib/server/players/league-blocked-players.ts`

Uso:

- import/upsert player
- blocco/sblocco per lega

### Reset dati leghe

- `lib/server/admin/reset-league-data.ts`

Uso:

- cancella solo dati di lega
- mantiene `User` e `Player`

## Azioni server rilevanti

### `app/admin/actions.ts`

Gestisce le modifiche admin:

- create league
- create/open/lock matchday
- generate league schedule
- generate required vote players
- save vote singolo
- save vote bulk
- generate demo votes
- calculate matchday scores
- generate fantasy fixtures
- calculate fantasy fixture results
- publish matchday
- block/unblock player in league
- deactivate/reactivate player globally
- reset league data

Tutte le action sensibili risultano protette da controllo admin.

### `app/me/actions.ts`

Gestisce le modifiche utente:

- create fantasy team
- leave league
- add/remove roster player
- save lineup

Le action controllano ownership della squadra e stato della giornata dove serve.

## Script utili oggi

### Quality e check

```bash
npm run check:all
npm run scoring:check
npm run scores:check
npm run fixtures:check
npm run schedule:check
```

### Bootstrap dati

```bash
npm run db:seed
npm run players:import-demo
npm run demo:matchday
```

### API-Football

```bash
npm run api-football:check
npm run players:import-api-football
```

### Admin e manutenzione

```bash
npm run auth:link-admin
npm run db:reset-leagues -- --confirm
```

## Variabili ambiente oggi rilevanti

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `API_FOOTBALL_KEY`
- `API_FOOTBALL_SERIE_A_LEAGUE_ID`
- `API_FOOTBALL_SEASON`
- `API_FOOTBALL_REQUEST_DELAY_MS`
- `API_FOOTBALL_MAX_TEAMS_PER_RUN`
- `API_FOOTBALL_START_TEAM_INDEX`

## Nota operativa per Cursor

Se continui sviluppo in Cursor, i file piu centrali da aprire per capire rapidamente il progetto sono:

1. `prisma/schema.prisma`
2. `app/admin/actions.ts`
3. `app/me/actions.ts`
4. `lib/server/public/read-public-league-data.ts`
5. `lib/server/me/read-user-data.ts`
6. `lib/server/admin/read-admin-data.ts`
7. `lib/scoring/*`
