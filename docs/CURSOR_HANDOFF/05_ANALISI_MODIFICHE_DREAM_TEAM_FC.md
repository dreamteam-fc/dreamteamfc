# Analisi Modifiche Dream Team FC

> **Storico.** Dove questo doc contraddice le regole shipping, vale [`09_DECISIONI_PRODOTTO_CHIUSE.md`](./09_DECISIONI_PRODOTTO_CHIUSE.md) (Gf/Rf +3 disgiunti; auto-carry `USER`|`COACH`; badge `INSERITA`/`MISTER`/`RECUPERATA`/`ADMIN`/`NON INSERITA`).

Questo documento traduce il file `Dream Team FC.txt` in richieste leggibili per sviluppo, tenendo conto di come Fantacalcetto funziona oggi.

## Nota iniziale su dati sensibili

Nel file originale erano presenti riferimenti che sembrano credenziali o dati di accesso. Non li riporto qui.

Azioni consigliate:

- non salvare credenziali operative nei documenti di handoff
- se quelle credenziali sono reali, considerarle esposte e cambiarle
- usare sempre `.env` o password manager

## Stato attuale da cui partiamo

Oggi il progetto ha gia:

- leghe
- squadre fantasy
- rose
- formazioni
- voti admin
- scoring
- scontri 1 vs 1
- calendario round-robin
- classifica di lega
- area admin
- area utente

Quindi le richieste nel file non partono da zero: vanno integrate dentro un sistema gia funzionante.

## Elenco richieste emerse dal file

### 1. Campionato limitato a 18 giornate

Richiesta:

- il campionato di lega deve arrivare fino alla 18esima giornata
- dopo la 18esima giornata il campionato e chiuso

Impatto sul progetto attuale:

- oggi il calendario round-robin genera tutte le giornate necessarie in base al numero squadre e alla modalita andata/ritorno
- non esiste un vincolo fisso a 18 giornate

Come applicarla al progetto:

- aggiungere una regola di lega o stagione che definisce `maxMatchdays = 18`
- impedire apertura o creazione di giornate oltre la 18esima
- se il calendario round-robin teorico produce piu di 18 giornate, serve una decisione prodotto:
  - troncare il calendario a 18
  - oppure limitare il numero di squadre/modalita per non superare 18

Osservazione importante:

- questa richiesta impatta direttamente la generazione calendario e le regole di campionato
- va chiarito prima se `18` e sempre fisso oppure configurabile

### 2. Torneo finale tra leghe — **FATTO** (V1 + voti XLS)

Richiesta (implementata):

- dopo la 18esima giornata l'admin crea un torneo
- il torneo unisce squadre provenienti da leghe diverse
- nella prima fase non si devono accoppiare squadre della stessa lega
- accoppiamento basato sui punteggi: piu alto contro piu basso
- andata e ritorno a eliminazione diretta
- finale solo andata
- accesso al torneo con password impostata dal super admin

Stato implementazione:

- dominio separato: `Tournament` / `TournamentTeamEntry` / `TournamentRound` / `TournamentFixture` / lineups
- voti per fase: `TournamentRequiredVotePlayer` + `TournamentPlayerVote` (non Matchday fake)
- flusso per fase: Apri formazioni (`lineupsStatus`) → Chiudi → genera lista → import XLS Fantacalcio → calcola gol (`convertScoreToGoals`) → avanzamento serie; manuale = override
- UI admin: `/admin/tournaments/.../bracket` (bottoni ordinati come giornata lega)

### 3. Account allenatore invitato — **FATTO**

Richiesta (implementata):

- un utente esistente puo invitare un account allenatore
- l'account allenatore puo solo impostare la formazione
- solo per la squadra del giocatore principale che lo ha invitato

Stato implementazione:

- delega team (`TeamCoachInvite` / coach attivo), non nuovo `UserRole`
- permesso limitato alle formazioni; no roster / join / admin / punteggi
- UI: gestione inviti su `/me/teams/[teamId]`, accettazione `/me/coach-invites/[token]`

### 4. Gestione "giocatore non giocato" nel pannello voti — DECISA

Decisione prodotto (2026-08-01):

- `non giocato = SV`
- nessun nuovo stato: si riusa `isSv` e la logica sostituzione gia esistente

Impatto sul progetto attuale:

- oggi esiste `isSv`
- il motore sostituzioni usa `isSv` o voto non valido per far entrare la panchina

Azione:

- nessuna modifica di dominio sullo stato: si riusa `isSv`
- estensioni operative (2026-08-01): giocatore assente dal file voti → SV; voto con asterisco → SV

### 5. Rosa da 25 giocatori con composizione per ruoli — DECISA

Decisione prodotto (2026-08-01):

- rosa di **25** giocatori (il "22" nel file sorgente era un errore)
- 3 portieri
- 8 difensori
- 8 centrocampisti
- 6 attaccanti

Impatto sul progetto attuale:

- oggi la rosa e da 8 giocatori con validazione semplice

Come applicarla al progetto:

- aggiornare `validateRosterComposition`
- aggiornare UI roster
- aggiornare azioni add/remove
- aggiornare seed/demo se necessario

### 6. Formazione titolari e panchina per ruoli

Richiesta:

- squadra da 5
- obbligatori:
  - 1 portiere
  - 1 attaccante
  - 1 centrocampista
  - 1 difensore
- il quinto giocatore e a scelta tra attaccante, centrocampista o difensore
- panchina di 4
- 1 per ruolo obbligatorio

Impatto sul progetto attuale:

- oggi la panchina e da 3
- oggi i titolari hanno vincoli:
  - 1 portiere
  - 1-2 difensori
  - almeno 1 attaccante
  - massimo 2 attaccanti
  - centrocampisti liberi

Come applicarla al progetto:

- aggiornare `validate-lineup-composition.ts`
- aggiornare la pagina lineup
- aggiornare il salvataggio lineup
- aggiornare scoring engine se la panchina passa da 3 a 4

Osservazione importante:

- qui la richiesta e chiara e realizzabile
- ma impatta fortemente lo scoring e il DB potrebbe richiedere solo aggiornamenti logici, non per forza schema

### 7. Sostituzioni automatiche per stesso ruolo

Richiesta:

- se un titolare non gioca, entra un panchinaro dello stesso ruolo
- se non giocano due titolari dello stesso ruolo e in panchina c'e un solo giocatore di quel ruolo, solo il primo viene sostituito e il secondo prende `0`

Impatto sul progetto attuale:

- motore: sub solo stesso ruolo; max 1 per ruolo (max 4); senza ordine panchina utente
- se manca panchina stesso ruolo (o sub di quel ruolo gia usata): titolare resta in XI con `0`

Come applicarla al progetto:

- aggiornare `calculate-team-score.ts`
- il dettaglio `TeamScorePlayer` deve salvare il motivo della sostituzione coerente con i ruoli
- panchina: vincolo ruolo (1/ruolo); `positionOrder` solo storage stabile, non priorita sub

Osservazione importante:

- questa e una modifica strutturale al motore punteggio
- va fatta insieme alla nuova regola panchina a 4

### 8. Fasce gol da punteggio — aggiornata 2026-08-08

Decisione prodotto:

- `score < 25` → 0 gol
- da 25 in poi: già 1 gol, poi +1 ogni 2 punti

Formula:

```text
goals = score < 25 ? 0 : 1 + Math.floor((score - 25) / 2)
```

Esempi: 24.9→0, 25→1, 26.9→1, 27→2, 29→3, 31→4

Impatto sul progetto attuale:

- implementata in `convert-score-to-goals.ts` (prima: `<=25 → 0`, poi solo `floor((score-25)/2)`)

Come applicarla al progetto:

- aggiornare `convertScoreToGoals`
- aggiornare i check manuali
- aggiornare eventuali testi UI che descrivono le fasce

### 9. Nuovi bonus e malus — AGGIORNATO 2026-08-01

Codici evento richiesti nel pannello voti / file import:

| Codice | Significato | Impatto fantavoto (se noto) | Campo attuale / target |
|--------|-------------|-----------------------------|-------------------------|
| `gf` | goal **non da rigore** | `+3` ciascuno | `goals` (XLS `Gf` esclude i gol da rigore) |
| `gs` | goal subito | `-1` ciascuno | `goalsConceded` (**solo P**) |
| `rp` | rigore parato | `+3` ciascuno | `penaltiesSaved` |
| `rs` | rigore **sbagliato** | `-3` ciascuno | `penaltiesMissed` |
| `rf` | gol da rigore | `+3` ciascuno | `penaltiesScored` (additivo a `gf`; Gf=1 Rf=1 → +6) |
| `au` | autogol | `-2` ciascuno | `ownGoals` |
| `amm` | ammonizione | `-0.5` ciascuna | `yellowCards` |
| `esp` | espulsione | `-1` ciascuna | `redCards` |
| `ass` | assist | `+1` ciascuno | `assists` |
| porta inviolata | auto se portiere con `gs = 0` | `+1` | `cleanSheet` |

> Bozza storica aveva `rf`=fallito / `rs`=subito. **Chiuso in `09`:** `RS` sbagliato (−3), `RF` gol da rigore (+3, disgiunto da `Gf`).

Regola automatica porta inviolata (decisa):

- se il giocatore e portiere e `gs == 0`, il sistema assegna `cleanSheet = 1` (+1)
- non richiedere inserimento manuale del bonus se la regola e soddisfatta

Stato shipping: implementato (vedi `09`); XLS `Gf`/`Rf` disgiunti entrambi +3.

### 10. Le leghe non sono create dagli utenti ma dal super admin — **FATTO**

Richiesta (implementata):

- solo il super admin crea le leghe
- l'admin di lega viene eliminato come concetto

Stato implementazione:

- creazione leghe solo area admin (`User.role = ADMIN`)
- `LeagueRole` = solo `OWNER` | `MEMBER` (`ADMIN` rimosso da schema + migration)
- Ruolo piattaforma: `UserRole` = `USER` | `MISTER` | `ADMIN` (Mister = pagelle/ops lega; non God mode)

### 11. Password di lega

Richiesta:

- il super admin crea la lega
- per entrare nella lega serve una password

Impatto sul progetto attuale:

- oggi il join a una lega non usa password

Come applicarla al progetto:

- aggiungere nel modello `League` un campo per password hash, non password in chiaro
- aggiornare `/leagues/[leagueId]/join`
- aggiornare la action `createFantasyTeamAction`
- aggiornare la creazione lega admin

Osservazione importante:

- non va mai salvata password lega in chiaro
- serve hashing server-side

### 12. Super admin con potere assoluto sulle rose

Richiesta:

- il super admin puo:
  - aggiungere un giocatore alla rosa di un utente
  - rimuoverlo
  - sostituirlo

Impatto sul progetto attuale:

- oggi solo l'utente owner o admin puo agire sulla propria rosa tramite area utente
- non esiste una UI admin per manipolare direttamente le rose utente

Come applicarla al progetto:

- aggiungere route admin per gestione squadre/rose
- creare azioni admin dedicate
- riusare la logica di validazione esistente evitando di duplicarla

Osservazione importante:

- fattibile, ma da fare dopo che la nuova composizione rosa e stata chiarita

### 13. Pannello voti unificato tra leghe

Richiesta:

- creare un pannello voti accessibile solo al super admin
- deve aggregare in un'unica lista i giocatori delle diverse leghe

Impatto sul progetto attuale:

- oggi i voti sono gestiti per singola giornata e singola lega
- il pannello admin attuale e gia protetto da admin globale

Come applicarla al progetto:

- creare una nuova vista admin aggregata
- la logica di salvataggio puo riusare `savePlayerVote`
- il reader dati dovra unire:
  - matchday
  - lega
  - required vote players

Osservazione importante:

- questa e soprattutto una feature UI/reader, meno un cambio di dominio

### 14. Admin vede se la formazione e stata inserita — NUOVA 2026-08-01

Richiesta:

- l'admin deve sapere, per ogni squadra / giornata, se la formazione e stata messa

Impatto sul progetto attuale:

- esiste `Lineup` legato a team + matchday
- oggi l'admin non ha una vista chiara "formazione presente / mancante" per tutte le squadre

Come applicarla al progetto:

- estendere reader admin matchday (e/o dashboard lega) con stato lineup per ogni `FantasyTeam`
- stati admin (chiusi in `09`): `INSERITA` | `MISTER` | `RECUPERATA` | `ADMIN` | `NON INSERITA`
- UI in `/admin/matchdays/[matchdayId]` o sezione dedicata

### 15. Import file voti per compilare le pagelle — NUOVA 2026-08-01

Richiesta:

- i pannelli voti devono permettere di caricare un file con i voti
- quei voti compilano automaticamente le pagelle (`PlayerVote`)

Regole di interpretazione del file (decise):

1. se un giocatore richiesto / in lista voti **non compare** nel file → `SV` (`isSv = true`, non ha giocato)
2. se il voto base ha **asterisco** (es. `6*`, `6.5*`) → trattarlo come `SV`
3. gli eventi usano i codici della sezione 9 (`gf`, `gs`, `rp`, `rs`, `rf`, `au`, `amm`, `esp`, `ass`)
4. per i portieri: se `gs = 0` → assegna porta inviolata (`cleanSheet = 1`, +1)

Impatto sul progetto attuale:

- oggi i voti si inseriscono manualmente (singolo / bulk UI)
- non esiste upload file ne parser voti
- `isSv` e gia il meccanismo corretto per "non giocato" e per asterisco

Come applicarla al progetto:

- endpoint/action admin: upload file → parse → upsert `PlayerVote` riusando `savePlayerVote` / bulk
- parser dedicato e testabile (puro) in `lib/server/votes/`
- dopo parse: marcare SV i required-players assenti dal file
- UI: controllo upload nel pannello voti (giornata e/o unificato)
- chiarire al primo implement il **formato file** reale (CSV/XLSX e colonne) se non allegato

Osservazione importante:

- soluzione stabile = parser + regole SV centralizzate, non logica solo in UI
- non duplicare il motore fantavoto: dopo import si ricalcola server-side come oggi

## Conclusione tecnica

Dal file emergono tre gruppi di lavoro molto diversi:

### Gruppo A - modifiche chiare e compatibili

- lega con password
- pannello voti unificato
- **upload file voti + regole SV (assente / asterisco)**
- **admin: stato formazione inserita/mancante**
- power tools del super admin sulle rose
- nuova panchina da 4 e nuovi vincoli formazione
- goal subito + automazione porta inviolata
- mappatura eventi `gf/gs/rp/rs/rf/au/amm/esp/ass`

### Gruppo B - modifiche grandi — **FATTO**

- ~~account allenatore invitato~~ **FATTO**
- ~~torneo cross-league dopo la 18esima~~ **FATTO** (V1 + voti XLS per fase)
- ~~campionato chiuso alla 18esima~~ **FATTO**

### Gruppo C - decisioni prodotto (chiuse)

- rosa da **25** (`3 + 8 + 8 + 6`)
- `non giocato = SV` (anche: assente dal file voti, oppure voto con `*`)
- fasce gol: `<25 → 0`; da 25: `1 + floor((score-25)/2)` (già 1 gol a 25)
- porta inviolata automatica se portiere con `gs = 0`
- `rs` = sbagliato (−3), `rf` = gol da rigore (+3, additivo a `gf`); vedi `09`
- formazione mancante: auto-carry ultima USER o COACH + penali; else forfait; vedi `09` §5b
- leghe da **10** squadre, solo andata/ritorno → **18** giornate
- max **1** sostituzione automatica **per ruolo** (max **4** a partita)
- `LeagueRole.ADMIN` rimosso

## Raccomandazione

Dream Team FC (scope prodotto chiuso in `09`) e implementato.
Prossimi lavori = nuove richieste esplicite o hardening/QA, non epic aperti da quel file.

Ordine storico (completato):

1. ~~chiarire le regole incoerenti~~
2. ~~bootstrap locale~~
3. ~~modifiche piccole (password, pannello voti, stato formazioni, import file)~~
4. ~~scoring, rosa, lineup~~
5. ~~torneo + account allenatore + voti XLS torneo~~
