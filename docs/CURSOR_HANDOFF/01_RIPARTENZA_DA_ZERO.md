# Ripartenza Da Zero

Questa e la procedura pratica per ricreare Fantacalcetto da zero su nuovi account.

## 1. Prerequisiti locali

- repository locale funzionante
- Node.js installato
- `npm install` gia eseguito
- accesso al terminale locale

## 2. Nuovo progetto Supabase

Creare un nuovo progetto Supabase.

Servono almeno questi valori:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- opzionale fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Se Prisma dovesse richiedere una connessione dedicata per operazioni schema, aggiungere anche:

- `DIRECT_URL`

## 3. Nuovo file env locale

Partire da `.env.example` e creare un nuovo `.env` locale.

Variabili attese oggi:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
API_FOOTBALL_KEY=
API_FOOTBALL_SERIE_A_LEAGUE_ID=135
API_FOOTBALL_SEASON=
API_FOOTBALL_REQUEST_DELAY_MS=1500
API_FOOTBALL_MAX_TEAMS_PER_RUN=
API_FOOTBALL_START_TEAM_INDEX=
```

## 4. Bootstrap database

Con il nuovo database configurato:

```bash
npm run prisma:generate
npm run prisma:validate
npx prisma migrate deploy
```

Se lavori solo in locale e devi creare il database da zero durante sviluppo, puoi valutare `prisma migrate dev`, ma non in produzione.

## 5. Popolamento iniziale consigliato

Hai due strade.

### Opzione A: demo veloce

```bash
npm run db:seed
npm run players:import-demo
```

Questa strada e utile per testare il flusso completo senza dipendere subito da API-Football.

### Opzione B: piu realistica

```bash
npm run players:import-api-football
```

Richiede:

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_SEASON`

## 6. Primo admin

Il progetto usa Supabase Auth per login.

Procedura pratica:

1. crea un utente reale da browser tramite `/signup`, oppure da Supabase Auth dashboard
2. recupera il Supabase Auth user id
3. collega quell'utente al record applicativo admin

Script disponibile:

```bash
npm run auth:link-admin
```

Da usare passando l'id utente secondo la logica prevista nello script `scripts/link-admin-auth-user.ts`.

Se serve, puoi anche aggiornare manualmente il record `User` nel DB:

- `authUserId = <supabase-auth-user-id>`
- `role = ADMIN`

## 7. Avvio locale

```bash
npm run dev
```

Route base da verificare subito:

- `/`
- `/signup`
- `/login`
- `/leagues`
- `/me`
- `/admin`

## 8. Flusso minimo per ripartire

Ordine consigliato:

1. crea admin
2. login admin
3. crea lega
4. crea o importa giocatori
5. fai signup con uno o piu utenti normali
6. fai join in lega
7. crea rosa
8. genera calendario
9. apri formazioni
10. schiera formazione
11. chiudi formazioni
12. genera lista voti richiesti
13. inserisci voti
14. calcola punteggi
15. calcola risultati scontri
16. pubblica giornata

## 9. Hosting nuovo

Puoi deployare dove vuoi, ma il progetto e gia impostato bene per:

- Supabase per DB e Auth
- Railway o Vercel per l'app Next.js

Per il deploy usa anche:

- [../DEPLOY_CHECKLIST.md](../DEPLOY_CHECKLIST.md)

## 10. Cosa non serve recuperare dal vecchio setup

Non serve recuperare:

- vecchi utenti Supabase Auth
- vecchio database
- vecchio URL Railway
- vecchie chiavi API gia perse

Il codice corrente e sufficiente per ripartire.
