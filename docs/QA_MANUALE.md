# QA manuale Fantacalcetto

Checklist pratica per test manuali da browser e terminale prima del deploy.

## Setup ambiente

### Cosa testare
- Installazione dipendenze e bootstrap locale.
- Variabili ambiente necessarie per Next.js, Prisma, Supabase Auth e API-Football.
- Database raggiungibile.
- Seed e reset dati di lega disponibili da terminale.

### Comandi utili
```bash
npm run check:all
npm run dev
npm run db:seed
npm run db:reset-leagues -- --confirm
npm run players:import-demo
npm run players:import-api-football
```

### Risultato atteso
- `npm run check:all` passa.
- `npm run dev` avvia l'app senza errori bloccanti.
- `db:seed` crea dati demo riutilizzabili.
- `db:reset-leagues -- --confirm` cancella solo i dati di lega, non `User` e non `Player`.

### Edge case
- Database remoto non raggiungibile: `fixtures:check` può saltare la parte DB-backed, ma `build` e i controlli puri devono comunque passare.
- Mancanza di `API_FOOTBALL_KEY` o `API_FOOTBALL_SEASON`: gli script API-Football devono fallire con messaggio chiaro.

## Auth

### Cosa testare
- Login da `/login` con utente admin.
- Login da `/login` con utente normale.
- Signup da `/signup`.
- Flusso `next` da `/login?next=...` e `/signup?next=...`.
- Logout.
- Forgot password e reset password.

### Risultato atteso
- Login admin reindirizza a `/admin` o al `next`.
- Login utente reindirizza a `/me` o al `next`.
- Signup crea solo utenti `USER`, mai `ADMIN`.
- Logout invalida sessione e impedisce accesso a pagine protette.
- Reset password aggiorna la password e permette un nuovo login.

### Edge case
- Signup con password corta.
- Signup con password e conferma diverse.
- Accesso con utente Supabase Auth non collegato: l'utente applicativo viene creato/collegato automaticamente se consentito.
- Admin non deve essere creato automaticamente da UI pubblica.

## Admin

### Cosa testare
- Accesso a `/admin` da admin autenticato.
- Navigazione dashboard admin.
- Link a leghe, giocatori globali, calendario, giornate, voti, punteggi.
- Logout dall'area admin.

### Risultato atteso
- Solo admin autenticato accede.
- Dashboard mostra leghe, capienza, giornate e link operativi.

### Edge case
- Utente normale autenticato su `/admin`: deve ricevere `Accesso non autorizzato` o redirect a login.
- Utente non autenticato su `/admin`: deve andare a `/login`.

## Leghe

### Cosa testare
- Creazione lega da `/admin/leagues/new`.
- Verifica `maxTeams` minimo 2, massimo 50, intero.
- Presenza della lega in `/admin`, `/leagues` e pagina pubblica lega.

### Risultato atteso
- La lega viene creata in stato coerente e visibile nelle liste.
- Dashboard admin mostra squadre attuali, posti disponibili e link pubblici.

### Edge case
- `maxTeams` vuoto, non numerico, minore di 2, maggiore di 50.
- Numero giornata duplicato nella stessa lega deve essere bloccato in seguito in creazione giornata.

## Join league

### Cosa testare
- Apertura `/leagues`.
- Apertura `/leagues/[leagueId]`.
- Accesso a `/leagues/[leagueId]/join` da utente autenticato.
- Creazione squadra fantasy in lega.
- Messaggi quando la lega è piena o iscrizioni chiuse.

### Risultato atteso
- La lega pubblica mostra iscritti, `maxTeams`, posti disponibili e CTA join solo quando permesso.
- `/join` crea `FantasyTeam` e `LeagueMember`.

### Edge case
- Utente non autenticato su `/join`: redirect a `/login?next=/leagues/[leagueId]/join`.
- Utente con squadra già presente nella stessa lega: messaggio e link alla squadra.
- Calendario già generato: iscrizioni chiuse.
- Lega piena: form disabilitato o nascosto.

## Roster

### Cosa testare
- Apertura `/me/teams/[teamId]/roster`.
- Ricerca `q` e filtro `role`.
- Aggiunta giocatori alla rosa.
- Rimozione giocatori dalla rosa.
- Visualizzazione stato rosa.

### Risultato atteso
- Si possono selezionare solo `Player.isActive = true` e non bloccati nella lega.
- La rosa mostra conteggi ruoli e validazione:
  - totale 8
  - minimo 1 portiere
  - minimo 2 difensori
  - minimo 2 attaccanti

### Edge case
- Tentativo di superare 8 giocatori.
- Duplicato dello stesso `Player` nella stessa rosa.
- Player globale inattivo già presente in rosa: resta visibile ma marcato `Non disponibile`.
- Player bloccato nella lega già presente in rosa: resta visibile ma marcato `Non disponibile`.
- Utente prova a gestire roster di team non suo.

## Lineup

### Cosa testare
- Apertura `/me/teams/[teamId]/matchdays/[matchdayId]/lineup`.
- Salvataggio formazione valida con 5 titolari e 3 panchinari.
- Modifica formazione finché la giornata è `LINEUPS_OPEN`.

### Risultato atteso
- Salvataggio consentito solo quando:
  - la squadra appartiene all'utente o l'utente è admin
  - la giornata è della stessa lega
  - `Matchday.status = LINEUPS_OPEN`
  - la rosa è valida
- Validazione titolari:
  - 1 GOALKEEPER
  - 1-2 DEFENDER
  - almeno 1 ATTACKER, massimo 2
  - MIDFIELDER libero

### Edge case
- Duplicato nella stessa formazione.
- Panchina senza 1 giocatore per ruolo (P/D/C/A).
- Player non appartenente alla rosa.
- Player bloccato in lega o inattivo globale.
- Tentativo di modifica fuori da `LINEUPS_OPEN`.

## Voti admin

### Cosa testare
- Apertura `/admin/matchdays/[matchdayId]/votes`.
- Generazione giocatori utili.
- Filtri `q`, `role`, `status`.
- Salvataggio singolo riga.
- Salvataggio bulk.
- Bottone dev per demo votes in ambiente non production.

### Risultato atteso
- Lista ordinata con priorità:
  - `PENDING`
  - `SV`
  - `COMPLETED`
  - `IGNORED`
- Contatori corretti:
  - totale richiesti
  - pending
  - completed
  - sv
  - ignored
- Le righe vuote sono ignorate nel bulk save.
- Se `isSv` è selezionato, `baseVote` non è richiesto.

### Edge case
- Ricerca senza risultati.
- Salvataggio bulk con righe valide e invalide insieme.
- Player inattivo globale o bloccato in lega: deve restare visibile con badge `Non disponibile`.
- Utente non admin che prova a invocare le action.

## Calcolo punteggi

### Cosa testare
- Apertura `/admin/matchdays/[matchdayId]/scores`.
- Verifica completion voti.
- Calcolo punteggi squadra.
- Visualizzazione dettagli `TeamScorePlayer`.

### Risultato atteso
- Calcolo consentito solo con voti richiesti completi.
- `TeamScore` e dettagli coerenti con:
  - titolari validi
  - sostituti entrati
  - SV non sostituiti a 0
  - panchina non usata

### Edge case
- Panchina senza sostituti validi.
- Massimo 3 sostituzioni.
- Nessuna `TeamScore` duplicata su ricalcolo.

## Pubblicazione giornata

### Cosa testare
- Da centro controllo admin o pagina scores:
  - generazione fixture
  - calcolo risultati fixture
  - pubblicazione giornata

### Risultato atteso
- `publishMatchday` pubblica:
  - `TeamScore`
  - `FantasyFixture` se presenti e calcolate
- La giornata passa a `PUBLISHED`.

### Edge case
- Pubblicazione senza fixture: deve restare retrocompatibile e non bloccare se previsto.
- Giornata già `PUBLISHED`: la pubblicazione deve essere idempotente.
- Fixture `SCHEDULED` o incomplete: pubblicazione bloccata.

## Classifica

### Cosa testare
- Apertura `/admin/leagues/[leagueId]/standings`.
- Apertura `/leagues/[leagueId]/standings`.
- Coerenza classifica dopo pubblicazione giornata.

### Risultato atteso
- Ordinamento per:
  1. punti
  2. differenza reti
  3. gol fatti
  4. fantapunti totali
  5. nome squadra

### Edge case
- Formazione **recuperata**: −2 fantapunti e −1 punto classifica (anche in vittoria; classifica può essere &lt; 0).
- Forfait (mai schierato): 3–0 + −1 classifica al perdente; doppio forfait 0–0 + −1 a entrambe.
- Squadre senza partite pubblicate: presenti con zeri.

## Pagine pubbliche

### Cosa testare
- `/`
- `/leagues`
- `/leagues/[leagueId]`
- `/leagues/[leagueId]/schedule`
- `/leagues/[leagueId]/standings`
- `/leagues/[leagueId]/matchdays/[matchdayId]`

### Risultato atteso
- Nessun login richiesto.
- Nessun dato admin o non pubblicato esposto.
- La giornata pubblica mostra:
  - scontri
  - risultati se pubblicati
  - fantapunti se pubblicati
  - dettaglio giocatori solo se la giornata è pubblicata/bloccata

### Edge case
- Giornata non pubblicata: deve mostrare solo accoppiamenti e stato.
- Calendario non generato: empty state chiaro.
- Turno di riposo correttamente calcolato.

## Giocatori globali

### Cosa testare
- `/admin/players`
- ricerca `q`
- filtri `role`, `source`, `status`
- disattiva/riattiva globale

### Risultato atteso
- `Player.isActive=false` rende il player non selezionabile in tutte le leghe.
- Il player inattivo resta visibile in rose già esistenti con badge `Non disponibile`.

### Edge case
- Grande numero di giocatori: pagina limitata a 100 risultati con messaggio sui risultati restanti.
- Source `unknown` deve filtrare source nulla o vuota.

## Blocchi giocatori per lega

### Cosa testare
- `/admin/leagues/[leagueId]/players`
- blocco player con o senza `reason`
- sblocco player
- effetto sulla pagina roster utente

### Risultato atteso
- Il blocco vale solo per la lega selezionata.
- Il player bloccato:
  - non è selezionabile per nuove rose in quella lega
  - resta selezionabile in altre leghe
  - resta visibile in una rosa esistente con badge `Non disponibile`

### Edge case
- Tentativo di schierare in lineup un player bloccato.
- Player globalmente attivo ma bloccato localmente.

## API-Football import

### Cosa testare
- Check con:
```bash
npm run api-football:check
```
- Import Serie A:
```bash
npm run players:import-api-football
```

### Risultato atteso
- Lo script di check legge `API_FOOTBALL_KEY` lato server e restituisce stato account/competizione senza scrivere nel DB.
- L'import:
  - upserta `Player`
  - usa `source = "api-football"`
  - mappa correttamente i ruoli
  - è idempotente

### Edge case
- `HTTP 429`: lo script deve fermarsi con messaggio chiaro senza corrompere il DB.
- Uso di:
  - `API_FOOTBALL_REQUEST_DELAY_MS`
  - `API_FOOTBALL_MAX_TEAMS_PER_RUN`
  - `API_FOOTBALL_START_TEAM_INDEX`
  per import a blocchi e resume.

## Sicurezza/permessi

### Cosa testare
- Utente non admin su route admin.
- Utente normale che prova a modificare squadra non sua.
- Tentativo di invocare action sensibili da sessione non autorizzata.

### Risultato atteso
- Route admin e action admin bloccate per utenti normali.
- Action utente consentite solo su team propri, salvo admin.
- Verifiche server-side coerenti su:
  - ownership team
  - membership lega
  - matchday nella stessa lega
  - stato lineup modificabile

### Edge case
- Utente non loggato su route protette.
- Utente con `next` malevolo o URL non valido: redirect sanitizzato.

## Regression check finale

### Cosa testare
- Regressione generale con terminale.
- Smoke test browser sulle route principali.

### Comandi
```bash
npm run check:all
```

### Risultato atteso
- `prisma:validate`, `prisma:generate`, `scoring:check`, `schedule:check`, `build` passano.
- `fixtures:check` passa nella parte pura e, se il DB è raggiungibile, anche nella parte DB-backed.

### Smoke test browser
- `/login`
- `/signup`
- `/me`
- `/admin`
- `/leagues`
- `/leagues/[leagueId]`
- `/admin/players`
- `/admin/matchdays/[matchdayId]/votes`

## Flusso end-to-end principale

### Sequenza
1. Admin esegue `npm run db:seed` se serve dati demo.
2. Admin crea una lega da `/admin/leagues/new`.
3. Utenti normali fanno login o signup.
4. Utenti entrano in lega da `/leagues/[leagueId]/join`.
5. Ogni utente crea la propria squadra fantasy.
6. Ogni utente compila la rosa da `/me/teams/[teamId]/roster`.
7. Admin genera il calendario lega.
8. Admin apre le formazioni per una giornata.
9. Utenti schierano la formazione.
10. Admin chiude le formazioni.
11. Admin genera i giocatori utili per i voti.
12. Admin inserisce i voti.
13. Admin calcola i punteggi squadra.
14. Admin genera o aggiorna i risultati fixture.
15. Admin pubblica la giornata.
16. Pubblico consulta risultati e classifica.

### Risultato atteso
- Tutto il flusso è eseguibile senza interventi manuali sul DB.
- I dati pubblici sono visibili solo dopo pubblicazione.

## Casi negativi principali

### Verifiche
- Utente non admin prova route admin.
- Utente prova a modificare team non suo.
- Salvataggio lineup fuori da `LINEUPS_OPEN`.
- Player bloccato in lega.
- Player disattivato globalmente.
- Lega piena.
- Calendario già generato.

### Risultato atteso
- Ogni caso viene bloccato server-side con messaggio chiaro:
  - `Non autorizzato.`
  - `Giornata non modificabile.`
  - `La lega ha raggiunto il numero massimo di squadre.`
  - `Le iscrizioni sono chiuse perché il calendario è già stato generato.`
  - `Uno o piu giocatori non sono disponibili.`
