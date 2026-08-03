# Decisioni prodotto chiuse — aggiornamento 2026-08-01 (sera)

Fonte primaria: `docs/Dream Team FC.txt` + risposte utente + file esempio
`data/voti-fantacalcio-esempio-giornata-38.xlsx`
(`Voti_Fantacalcio_Stagione_2025_26_Giornata_38.xlsx`).

**Non documentare/reinserire** email, password o credenziali GitHub presenti in `Dream Team FC.txt` (da considerare esposte).

---

## 1. Rosa e formazione

| Regola | Valore |
|--------|--------|
| Rosa | **25** = 3P + 8D + 8C + 6A |
| Esclusività giocatore | stesso `Player` **non** può stare in più `FantasyTeam` della stessa lega; DB `FantasyRoster @@unique([leagueId, playerId])` + assert in `lib/server/rosters/league-player-exclusivity.ts` |
| Lock rosa owner | owner può add/remove **solo se count < 25**; a **count >= 25** rosa congelata (solo Admin); policy in `lib/server/rosters/roster-edit-policy.ts` |
| Titolari | **5**: 1P + 1D + 1C + 1A + 1 libero tra D/C/A |
| Panchina | **4**: 1 per ruolo (P, D, C, A) |
| Ordine panchina | **rimosso** (UI/validazione); `positionOrder` DB auto P=1…A=4 |
| Sostituzione auto | solo stesso ruolo |
| Max sub auto | **1 sola** a partita (anche se piu titolari SV) |
| Se manca panchina stesso ruolo | il titolare SV resta **0** |

## 2. Campionato e leghe

| Regola | Valore |
|--------|--------|
| Dimensione lega | **obbligatoriamente 10 squadre** |
| Calendario | **solo andata e ritorno** (niente “solo andata”) |
| Giornate | **18** = (10−1)×2 — poi campionato chiuso |
| Creazione leghe | solo super admin |
| Password lega | **obbligatoria** (hash server-side) |
| Admin di lega | eliminato come concetto |

## 3. Scoring giocatore

Formula: `baseVote + bonus − malus`.

| Codice file | Significato | Punti | Chi |
|-------------|-------------|-------|-----|
| `gf` | goal fatto | +3 | tutti |
| `ass` | assist | +1 | tutti |
| `rp` | rigore **parato** | +3 | tipicamente P (`penaltiesSaved`) |
| `gs` | goal subito | −1 | **solo portieri** |
| `rs` | rigore **sbagliato** | −3 | tutti (`penaltiesMissed`) |
| `rf` | rigore **realizzato** | **0** (tracciamento) | tutti (`penaltiesScored`); il gol e gia in `gf` |
| `au` | autogol | −2 | tutti |
| `amm` | ammonizione | −0.5 | tutti |
| `esp` | espulsione | −1 | tutti |
| porta inviolata | auto se P e `gs = 0` e ha giocato (non SV) | +1 | solo P |

> Nota: una vecchia bozza del doc diceva `rs`=subito / `rf`=fallito. **Decisione chiusa 2026-08-01:** vale la tabella sopra (`RS` sbagliato, `RF` realizzato).


Fasce gol da punteggio squadra:

```text
goals = score <= 25 ? 0 : Math.floor((score - 25) / 2)
```

## 4. Import voti XLS

- File esempio in `data/voti-fantacalcio-esempio-giornata-38.xlsx`
- Fogli presenti: `Fantacalcio`, `Statistico`, `Italia` (stessa struttura)
- Colonne dati (riga header `Cod.`):  
  `Cod. | Ruolo | Nome | Voto | Gf | Gs | Rp | Rs | Rf | Au | Amm | Esp | Ass`
- Matching giocatore: **`Cod.` = externalId** sorgente `fantacalcio-quotazioni`
- Righe “nome squadra” senza codice numerico: ignorare
- Voto con `*` (es. `6*`) → **SV**
- Giocatore in lista voti richiesta ma **assente** dal file → **SV**
- Default foglio da usare: **`Fantacalcio`** salvo diversa scelta admin in UI

## 5. Pannello voti e formazioni admin

- Upload XLS nei pannelli voti
- Pannello unificato multi-lega: mostra **solo chi ha effettivamente giocato** dopo le sostituzioni (opzione A)
- Admin vede per ogni squadra/giornata: formazione `INSERITA` / `NON_INSERITA`

## 6. Torneo — **FATTO** (V1 + voti XLS)

- Dopo 18ª giornata
- Admin crea torneo e **sceglie a mano** le squadre + lega di provenienza
- Seeding: alto vs basso; in 1ª fase **no** scontri stessa lega
- Eliminazione diretta andata/ritorno; **finale solo andata**
- Password iscrizione obbligatoria (come leghe)
- Formazioni torneo su `TournamentFixture` READY (apri/chiudi con `Tournament.lineupsOpen`)
- Avanzamento serie via `recordTournamentFixtureResult` (pareggio aggregato → seed migliore)

### Voti Fantacalcio XLS sul torneo (scoped a `TournamentRound`)

Flusso admin su `/admin/tournaments/[id]/bracket` per ogni fase:

1. Formazioni READY schierate
2. **Genera lista voti** → `TournamentRequiredVotePlayer` (unione giocatori in lineup READY)
3. **Importa XLS** → stesso parser lega (`parseFantacalcioVotesBuffer`); matching `Cod.` = `externalId`; assenti → SV
4. **Calcola partite da voti** → fantavoto + `convertScoreToGoals` (stesse fasce campionato) → `recordTournamentFixtureResult` sulle fixture READY
5. **Risultato manuale** resta override alternativo sulle partite READY (non forza Matchday fake)

Modelli: `TournamentRequiredVotePlayer`, `TournamentPlayerVote` su `TournamentRound`.
Libs: `lib/server/tournaments/tournament-votes.ts`, `import-tournament-votes.ts`, `calculate-tournament-round-results.ts`.

## 7. Account allenatore — **FATTO**

- Solo da invito di utente esistente (`TeamCoachInvite` / coach attivo su squadra)
- Puo solo impostare formazione della squadra dell’invitante
- UI: `/me/teams/[teamId]` (gestione inviti) + `/me/coach-invites/[token]` (accettazione)

## 8. Poteri admin / ruoli piattaforma

- CRUD giocatori nelle rose utente (add/remove/replace) — solo **Admin** (dopo il lock a 25; Mister/coach non modificano rose)
- Aprire/chiudere giornate, punteggi, calendario — **Admin** e **Mister**
- Pagelle Fantacalcio XLS (lega / unificato) — **Admin** e **Mister**
- Tornei, creazione leghe, reset, ruoli piattaforma — solo **Admin**
- Nessun admin di lega separato
- `LeagueRole` = solo `OWNER` | `MEMBER` (membership in lega)
- `UserRole` = `USER` | `MISTER` | `ADMIN` (ruolo piattaforma; assegnabile da `/admin`)
- Bootstrap sicuro: `ADMIN_EMAIL` promuove a `ADMIN` al login solo se non esiste già alcun Admin; poi DB è source of truth

---

## Aperti (deferred)

Nessuna domanda aperta su `rp` / `rs` / `rf` dopo conferma utente 2026-08-01:
- `Rp` parati +3
- `Rs` sbagliati −3 (anche su non-portieri)
- `Rf` realizzati 0 pt (tracciati; gol in `Gf`)
- foglio default: **Fantacalcio** (confermato in uso)

Epic prodotti coach + torneo V1 (con voti XLS) **chiusi**. Nessun altro epic prodotto aperto da `Dream Team FC.txt`.

### Ordine in corso (proposta, attiva)

1. ~~Admin: stato formazioni~~ **FATTO**
2. ~~Rosa 25 + lineup 5+4 + max 1 sub stesso ruolo~~ **FATTO**
3. ~~Scoring (`gs` solo P, `rs` sbagliato −3, clean sheet auto, fasce gol)~~ **FATTO**
4. ~~Parser/upload XLS voti + matching `Cod.`~~ **FATTO** (`Rp`/`Rs`/`Rf` allineati)
5. ~~Pannello voti unificato (solo chi ha giocato)~~ **FATTO** (`/admin/votes`, fan-out save/import)
6. ~~Password lega + maxTeams=10 forzato A/R=18~~ **FATTO**
7. ~~Poteri rose admin (add/remove/replace)~~ **FATTO** (`/admin/leagues/[id]/teams`, `/admin/teams/[id]/roster`)
8. ~~Coach (invito + sola formazione)~~ **FATTO**
9. ~~Torneo V1 (bracket, seeding, password, formazioni, avanzamento)~~ **FATTO**
10. ~~Torneo voti XLS → fantavoto → gol (stesso scoring lega; manuale = override)~~ **FATTO**
11. ~~`LeagueRole.ADMIN` rimosso~~ **FATTO** (restano `OWNER`/`MEMBER`)
12. ~~Ruoli piattaforma `USER`/`MISTER`/`ADMIN` + pannello assegnazione~~ **FATTO**
