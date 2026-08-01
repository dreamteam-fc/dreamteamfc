# Stato Attuale Del Progetto

Questa e la fotografia del progetto oggi, lato funzionalita e perimetro applicativo.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma 6.19
- PostgreSQL su Supabase
- Supabase Auth

## Aree applicative presenti

### 1. Area pubblica

Disponibile senza login.

Route principali:

- `/`
- `/leagues`
- `/leagues/[leagueId]`
- `/leagues/[leagueId]/schedule`
- `/leagues/[leagueId]/standings`
- `/leagues/[leagueId]/matchdays/[matchdayId]`

Funzioni:

- vedere elenco leghe
- vedere classifica pubblica
- vedere calendario pubblico
- vedere dettaglio giornata pubblicata
- entrare in una lega tramite CTA verso join

### 2. Area utente autenticata

Route principali:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/me`
- `/me/teams/[teamId]`
- `/me/teams/[teamId]/roster`
- `/me/teams/[teamId]/matchdays/[matchdayId]/lineup`
- `/leagues/[leagueId]/join`

Funzioni:

- login e signup tramite Supabase Auth
- creazione automatica utente applicativo `USER` se manca
- join in lega
- creazione squadra fantasy
- gestione rosa
- gestione formazione per giornata aperta
- abbandono lega con vincoli
- vista personale squadra, calendario, prossima giornata, avversario e risultati

### 3. Area admin protetta

Route principali:

- `/admin`
- `/admin/leagues/new`
- `/admin/leagues/[leagueId]/schedule`
- `/admin/leagues/[leagueId]/players`
- `/admin/leagues/[leagueId]/standings`
- `/admin/matchdays/[matchdayId]`
- `/admin/matchdays/[matchdayId]/votes`
- `/admin/matchdays/[matchdayId]/scores`
- `/admin/players`

Funzioni:

- creare leghe
- creare giornate o generare calendario completo round-robin
- aprire e chiudere inserimento formazioni
- generare scontri giornata
- generare lista giocatori da votare
- inserire voti singoli o bulk
- generare voti demo pending in dev
- calcolare punteggi squadra
- calcolare risultati scontri fantasy
- pubblicare giornata
- vedere classifica admin
- gestire giocatori globali
- bloccare giocatori per singola lega
- resettare dati lega da zona pericolosa

## Dominio coperto oggi

### Leghe

- una lega ha `maxTeams`
- le iscrizioni si chiudono se il calendario e gia stato generato
- una squadra fantasy appartiene a una lega
- un utente puo avere una squadra per lega

### Rosa

Regole attuali:

- esattamente 8 giocatori
- minimo 1 portiere
- minimo 2 difensori
- minimo 2 attaccanti
- centrocampisti liberi
- nessun duplicato nella stessa rosa
- lo stesso player puo stare in squadre di leghe diverse

### Formazione

Regole attuali:

- 5 titolari
- 3 panchinari
- panchina ordinata 1, 2, 3
- titolari:
  - esattamente 1 portiere
  - almeno 1 difensore
  - almeno 1 attaccante
  - massimo 2 difensori
  - massimo 2 attaccanti

### Voti e punteggi

- supporto SV
- supporto eventi granulari:
  - goals
  - assists
  - yellowCards
  - redCards
  - ownGoals
  - penaltiesMissed
  - penaltiesSaved
  - cleanSheet
- fantavoto calcolato server-side
- sostituzioni automatiche fino a `league.maxAutoSubs`
- dettaglio punteggio squadra persistito

### Scontri diretti e classifica

- fixture 1 vs 1 per giornata
- conversione punteggio -> gol
- tavolino gestito:
  - solo casa con score: 3-0
  - solo trasferta con score: 0-3
  - nessuna con score: 0-0 senza punti
- classifica calcolata da fixture pubblicate

### Giocatori

- player demo e player importabili da API-Football
- ruoli:
  - GOALKEEPER
  - DEFENDER
  - MIDFIELDER
  - ATTACKER
- attivazione/disattivazione globale
- blocco per singola lega senza disattivazione globale

## Stato tecnico generale

Il progetto non e piu un MVP vuoto. Ha gia:

- auth base
- aree separate pubblico / utente / admin
- schema Prisma ricco e coerente col dominio
- script di seed e di controllo
- docs di QA e deploy

## Parti ancora non coperte

Non risultano ancora implementate queste aree:

- asta o mercato
- assegnazione automatica rosa
- editing avanzato lega
- notifiche
- onboarding email evoluto
- gestione multi-admin sofisticata
- storico stagioni
- recupero dati dal vecchio sistema
