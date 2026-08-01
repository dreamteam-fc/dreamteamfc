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
| Titolari | **5**: 1P + 1D + 1C + 1A + 1 libero tra D/C/A |
| Panchina | **4**: 1 per ruolo (P, D, C, A) |
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

## 6. Torneo (epic separato)

- Dopo 18ª giornata
- Admin crea torneo e **sceglie a mano** le squadre + lega di provenienza
- Seeding: alto vs basso; in 1ª fase **no** scontri stessa lega
- Eliminazione diretta andata/ritorno; **finale solo andata**
- Password iscrizione obbligatoria (come leghe)

## 7. Account allenatore (epic separato)

- Solo da invito di utente esistente
- Puo solo impostare formazione della squadra dell’invitante

## 8. Poteri admin

- CRUD giocatori nelle rose utente (add/remove/replace)
- Aprire/chiudere giornate, punteggi, calendario
- Nessun admin di lega separato

---

## Aperti (deferred)

Nessuna domanda aperta su `rp` / `rs` / `rf` dopo conferma utente 2026-08-01:
- `Rp` parati +3
- `Rs` sbagliati −3 (anche su non-portieri)
- `Rf` realizzati 0 pt (tracciati; gol in `Gf`)
- foglio default: **Fantacalcio** (confermato in uso)

Restano solo epic prodotti: coach, torneo.

### Ordine in corso (proposta, attiva)

1. ~~Admin: stato formazioni~~ **FATTO**
2. ~~Rosa 25 + lineup 5+4 + max 1 sub stesso ruolo~~ **FATTO**
3. ~~Scoring (`gs` solo P, `rs` sbagliato −3, clean sheet auto, fasce gol)~~ **FATTO**
4. ~~Parser/upload XLS voti + matching `Cod.`~~ **FATTO** (`Rp`/`Rs`/`Rf` allineati)
5. ~~Pannello voti unificato (solo chi ha giocato)~~ **FATTO** (`/admin/votes`, fan-out save/import)
6. ~~Password lega + maxTeams=10 forzato A/R=18~~ **FATTO**
7. ~~Poteri rose admin (add/remove/replace)~~ **FATTO** (`/admin/leagues/[id]/teams`, `/admin/teams/[id]/roster`)
8. Coach  
9. Torneo  
