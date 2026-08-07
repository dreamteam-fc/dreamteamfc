# Manuale Admin — Dream Team FC / Fantacalcetto

Manuale operativo per chi gestisce la stagione (Admin e, dove indicato, Mister).  
Non è documentazione tecnica: spiega **cosa fare in app**, in che ordine, e come risolvere i problemi tipici.

**Regolamento ufficiale (regole di gioco):** [REGOLAMENTO.md](./REGOLAMENTO.md)  
**Manuale utente (owner/coach):** [MANUALE_UTENTE.md](./MANUALE_UTENTE.md)

**Area staff:** `/admin`  
**App pubblica / utente:** `/leagues/...`, `/me/...`, `/tournaments/...`

---

## Indice

1. [Ruoli: Admin, Mister, User, Coach](#1-ruoli-admin-mister-user-coach)
2. [Dashboard `/admin` e bottoni principali](#2-dashboard-admin-e-bottoni-principali)
3. [Setup stagione (da zero)](#3-setup-stagione-da-zero)
4. [Workflow settimanale di lega](#4-workflow-settimanale-di-lega)
5. [Pagelle unificate e file XLS](#5-pagelle-unificate-e-file-xls)
6. [Torneo (workflow completo)](#6-torneo-workflow-completo)
7. [Fine stagione: WIPE TORNEO / WIPE LEGHE](#7-fine-stagione-wipe-torneo--wipe-leghe)
8. [Inviti coach e loghi squadra](#8-inviti-coach-e-loghi-squadra)
9. [Cosa può fare l’utente vs solo Admin](#9-cosa-può-fare-lutente-vs-solo-admin)
10. [Problemi comuni](#10-problemi-comuni)
11. [Checklist rapida](#11-checklist-rapida)

---

## 1. Ruoli: Admin, Mister, User, Coach

Esistono due livelli di “potere”:

- **Ruolo piattaforma** (chi sei nell’app): `USER` | `MISTER` | `ADMIN`
- **Ruolo in lega** (membership): solo `OWNER` (proprietario squadra) o `MEMBER` — **non** esiste un “admin di lega”

I ruoli piattaforma si assegnano da **`/admin/permessi`** (solo Admin).

### 1.1 Admin (super-operatore)

Può tutto ciò che serve a far funzionare la stagione:

- Dashboard batch multi-lega (apri/chiudi formazioni, calcola, pubblica, calendari, formazioni random)
- Crea leghe e tornei
- Catalogo giocatori (upload quotazioni Excel)
- Modifica rose anche dopo il blocco a 25
- Wipe fine anno
- Assegna Mister / Admin ad altri account

### 1.2 Mister (operatore giornata)

Entra in `/admin` e gestisce le operazioni **giornata per giornata**:

- Pagelle unificate XLS (`/admin/votes`)
- Hub formazioni, dettaglio giornata, voti e punteggi per matchday
- Apertura/chiusura formazioni e calcoli **sulla singola giornata** (dove i bottoni sono presenti)

**Non** vede (o non può usare) i bottoni batch multi-lega della dashboard, né wipe, né creazione leghe/tornei, né permessi, né CRUD rose admin.

### 1.3 User (giocatore / owner)

- Si iscrive a una lega con password
- Crea la propria squadra e costruisce la rosa (25 giocatori)
- Inserisce la formazione di lega e di torneo (quando aperte)
- Invita un coach
- Carica il logo della squadra

Quando la rosa arriva a **25 giocatori**, l’owner **non può più modificarla**: da quel momento solo l’Admin può intervenire.

### 1.4 Coach (allenatore invitato)

- Accetta un invito via link/token
- Può **solo** impostare la formazione della squadra che lo ha invitato (lega + torneo)
- **Non** modifica la rosa

---

## 2. Dashboard `/admin` e bottoni principali

Dopo il login con account Admin o Mister vai su **`/admin`**.

- Header **Admin** → “Dashboard amministrazione”
- Header **Mister** → “Dashboard operativa” (meno bottoni)

### 2.1 Link sempre utili

| Pulsante / link | Percorso | Chi |
|-----------------|----------|-----|
| Pagelle unificate | `/admin/votes` | Admin + Mister |
| Tornei | `/admin/tournaments` | solo Admin |
| Hub formazioni | `/admin/lineups` | Admin (+ Mister via path) |
| Giocatori | `/admin/players` | solo Admin (link in dashboard) |
| Crea nuova lega | `/admin/leagues/new` | solo Admin |
| Permessi | `/admin/permessi` | solo Admin (in alto a destra) |

### 2.2 Batch multi-lega (solo Admin)

In alto nella sezione **Leghe**, i bottoni che agiscono su **tutte le leghe** (o sulle giornate “utili” di ciascuna):

1. **Genera calendari** — crea il calendario A/R per le leghe ancora senza schedule  
2. **Genera formazioni** — formazioni casuali (utile per test o squadre assenti)  
3. **Apri formazioni** — apre l’inserimento lineup sulle prossime giornate utili  
4. **Chiudi formazioni** — chiude le lineup  
5. **Calcola punteggi e risultati** — dopo i voti  
6. **Pubblica giornate** — rende pubblici risultati e aggiorna le classifiche  

> **Nota timeout:** con molte leghe un click batch può superare il tempo del server/proxy. Se fallisce, riprova oppure lavora lega per lega / giornata per giornata (vedi §10).

### 2.3 Card di ogni lega

Per ogni lega vedi:

- Membri, squadre `X/10`, posti liberi, rose complete
- Link: **Genera calendario**, **Squadre / rose**, **Giocatori**, **Vedi lega**, **Vedi classifica**
- Blocco **Giornata N** (la prossima utile) con:
  - **Dettaglio giornata** → `/admin/matchdays/[id]`
  - **Gestisci voti** → `/admin/matchdays/[id]/votes`
  - **Vedi punteggi** → `/admin/matchdays/[id]/scores`
  - Eventuale **Genera formazioni casuali** / **Chiudi formazioni**

---

## 3. Setup stagione (da zero)

Ordine consigliato. Non saltare i passi: senza catalogo i voti non matchano; senza 10 squadre e calendario non parte il campionato.

### Passo 1 — Catalogo giocatori (Excel quotazioni)

1. Vai su **`/admin/players`**
2. Carica il file **quotazioni Fantacalcio** (Excel)
3. Mode automatica:
   - **WIPE** — solo se non esistono leghe né tornei (inizio stagione pulito)
   - **SYNC** — se leghe/tornei esistono già (aggiorna senza distruggere tutto)

Il matching dei voti settimanali usa la colonna **`Cod.`** del file Fantacalcio = codice giocatore in catalogo.  
**Usa sempre la lista quotazioni Fantacalcio**, non liste di altre sorgenti.

### Passo 2 — Crea le leghe

1. **`/admin/leagues/new`**
2. Nome + **password obbligatoria**
3. Ogni lega è da **10 squadre**
4. Calendario = **solo andata e ritorno** → **18 giornate**

Comunica password e link lega agli utenti (`/leagues/...`).

### Passo 3 — Utenti: join, squadra, rosa

Gli utenti:

1. Si registrano / accedono
2. Entrano in lega con la password
3. Creano la squadra in **`/me/...`**
4. Compongono la rosa **25** = **3P + 8D + 8C + 6A**
5. Stesso giocatore **non** può stare in due rose della stessa lega

Se qualcuno resta bloccato o sbaglia rosa a 25: Admin interviene da  
**`/admin/leagues/[lega]/teams`** → **`/admin/teams/[squadra]/roster`**.

### Passo 4 — Calendario

Quando ci sono le 10 squadre (o comunque quando sei pronto a generare):

- **Batch:** `/admin` → **Genera calendari**, oppure  
- **Per lega:** `/admin/leagues/[lega]/schedule` → **Genera calendario andata/ritorno**

Risultato: 18 giornate con le partite.

### Passo 5 — Controlli pre-stagione

- Rose complete (dashboard mostra “Rose complete: X/Y”)
- Hub formazioni **`/admin/lineups`** per vedere chi manca
- Opzionale: formazioni random di prova (solo Admin), poi ripeti il flusso reale

---

## 4. Workflow settimanale di lega

**Non c’è alcun automatismo:** se non clicchi un passo, la giornata resta ferma.

### Flusso ideale (multi-lega, Admin)

| # | Azione | Dove |
|---|--------|------|
| 1 | **Apri formazioni** | `/admin` (batch) oppure dettaglio giornata / schedule |
| 2 | Avvisa owner/coach della deadline | fuori app (chat/WhatsApp) |
| 3 | Controlla chi ha schierato | `/admin/lineups` |
| 4 | (Opzionale) Genera formazioni random per chi manca | `/admin` o card giornata |
| 5 | **Chiudi formazioni** | `/admin` batch o singola giornata |
| 6 | Importa pagelle XLS | `/admin/votes` (consigliato) |
| 7 | **Calcola punteggi e risultati** | `/admin` o da `/admin/votes` (calcola anche gli scontri) |
| 8 | Controlla | `/admin/matchdays/[id]/scores` |
| 9 | **Pubblica giornate** | `/admin` o `/admin/votes` |
| 10 | Verifica pubblica | `/leagues/[id]/standings` e pagina giornata |

Su `/admin/matchdays/[id]`, sezione **Stato formazioni**: badge **INSERITA** (owner), **MISTER** (allenatore/coach), **RECUPERATA**, **ADMIN**, **NON INSERITA**; tasto **Elimina formazione** per squadra (DRAFT / OPEN / LOCKED, prima di voti/punteggi).

L’owner/coach può eliminare la propria formazione da `/me/teams/.../lineup` solo a formazioni **aperte**.

### Flusso Mister (senza batch)

1. Apri/chiudi dalla **giornata** (`/admin/matchdays/[id]`) o dalla schedule della lega  
2. Usa **`/admin/votes`** per l’XLS su tutte le leghe della stessa giornata N  
3. Calcolo e pubblicazione: dalla pagina voti della giornata o dai link per matchday (i bottoni batch globali restano ad Admin)

### Regole formazione (per ricordarle agli utenti)

- **5 titolari** (1P + 1D + 1C + 1A + 1 libero tra D/C/A)  
- **4 panchina** (1 per ruolo: P, D, C, A)  
- Sostituzione automatica: solo **stesso ruolo**, max 1 per ruolo  
- Se il titolare è SV e non c’è panchina dello stesso ruolo → vale **0**

### Gol da fantapunti (utile in chat)

- Punteggio squadra ≤ 25 → **0 gol**  
- Altrimenti gol = metà della parte oltre 25 (arrotondato per difetto)

### Forfait / formazione recuperata

Alla **chiusura formazioni**, se manca la formazione:

1. Se esiste un’ultima formazione **USER o COACH** in quella lega → viene **recuperata** (badge admin **RECUPERATA**)
2. Penalità: **−2 fantapunti** sulla partita (prima dei gol) e **−1** in classifica (anche se vince; classifica può essere negativa)
3. Se **non** ha mai schierato in quella lega → **forfait 3–0** (nessun calcolo fantapunti) + **−1** classifica
4. Entrambe senza precedente → doppio forfait 0–0 + **−1** a entrambe

In **torneo**: stesso recupero/forfait, ma solo **−2 FP** (niente classifica).

“Genera formazioni” (random admin) resta utile in test; fonte del recupero automatico = solo `USER` o `COACH` (non `AUTO_CARRIED` né `ADMIN_RANDOM`).

---

## 5. Pagelle unificate e file XLS

Percorso: **`/admin/votes`** (Admin e Mister).

### 5.1 Cosa fa

Un solo upload del file Fantacalcio della giornata Serie A, applicato a **tutte le leghe** sulla stessa **giornata N** (es. giornata fantasy 3).

Mostra i giocatori che **hanno effettivamente giocato** (dopo le logiche di formazione/sostituzione, o titolari se i punteggi non sono ancora calcolati).

### 5.2 Passi

1. Apri `/admin/votes`
2. Seleziona **Giornata N** (chip in alto)
3. Opzionale ma utile: **Genera liste voti su tutte le leghe**
4. Scegli il file `.xls` / `.xlsx` Fantacalcio
5. Clicca **Carica e propaga**  
   (genera le liste mancanti e importa su tutte le leghe)
6. Controlla il messaggio verde/rosso in alto (errori per lega)
7. Admin: **Calcola punteggi e risultati** → **Pubblica giornate**

Alternativa per una sola lega: `/admin/matchdays/[id]/votes`.

### 5.3 File Fantacalcio — regole pratiche

- Foglio da usare di default: **`Fantacalcio`**
- Colonna chiave: **`Cod.`** (deve combaciare col catalogo caricato a inizio stagione)
- Righe “nome squadra” senza codice numerico: vengono ignorate
- Voto con asterisco (es. `6*`) → trattato come **SV**
- Giocatore in lista richiesta ma assente dal file → **SV**
- Colonne eventi: **`Gf`** = gol non da rigore (+3), **`Rf`** = gol da rigore (+3, **si somma** a Gf; non è già incluso in Gf)

Se i voti “non attaccano”: quasi sempre il catalogo non è quello Fantacalcio o i `Cod.` non coincidono → ricontrolla `/admin/players`.

---

## 6. Torneo (workflow completo)

Solo **Admin**. Tipicamente dopo la 18ª giornata di campionato.

### 6.1 Creazione e iscrizione

1. **`/admin/tournaments`** → nuovo torneo → **`/admin/tournaments/new`**
2. Nome + **password di iscrizione**
3. **`/admin/tournaments/[id]/entries`**: seleziona a mano le squadre (da leghe diverse)
4. Dimensioni ammesse: **4 / 8 / 16 / 32 / 64**
5. Salva entries → **Genera tabellone**

Regole tabellone:

- Seeding alto ↔ basso (usa i punti classifica salvati come snapshot)
- In prima fase: **niente scontri stessa lega** (dove possibile)
- Fasi a **andata e ritorno**, tranne la **finale** (solo andata)

### 6.2 Operatività per fase / gamba

Vai su **`/admin/tournaments/[id]/bracket`**.

Per ogni fase (e per ogni gamba andata/ritorno):

1. **Apri formazioni** (stato fase: non aperte → aperte)
2. Gli utenti schierano da  
   `/me/teams/[teamId]/tournaments/fixtures/.../lineup`
3. **Chiudi formazioni**
4. **Genera lista voti** (per la gamba corretta: andata ≠ ritorno)
5. **Carica XLS** di quella giornata Serie A / di quella gamba
6. **Calcola** i risultati da voti
7. Controlla avanzamento serie sul tabellone

> Importante: i voti del torneo sono **separati per gamba**. Non riusare alla cieca lo stesso file sulla gamba sbagliata.

### 6.3 Pareggi e scelta vincitore

- A fine serie (andata+ritorno), se c’è pareggio aggregato di solito vince il **seed migliore**
- Se resta un pareggio senza vincitore automatico, in bracket compare l’azione Admin per **scegliere il vincitore** della serie — fallo consapevolmente

Esiste anche l’inserimento **risultato manuale** come override su partite ancora READY (alternativa ai voti, da usare solo se serve).

### 6.4 Reset (se sbagli un passo)

Sul tabellone/admin torneo puoi:

- Reset risultati di una fase / gamba (per ricalcolare)
- In casi estremi, tornare allo stato entries (prima del bracket) — attenzione: è distruttivo per il progresso del torneo

---

## 7. Fine stagione: WIPE TORNEO / WIPE LEGHE

Zona pericolosa in basso su **`/admin`** (e richiami su `/admin/players`).  
**Solo Admin.** Digita esattamente le frasi di conferma.

### Ordine obbligatorio

1. Digita **`WIPE TORNEO`** → elimina tutti i tornei e dati collegati (**non** tocca le leghe)
2. Digita **`WIPE LEGHE`** → elimina leghe, squadre, rose, giornate, voti, risultati  
   (rifiuta se esistono ancora tornei)
3. Vai su **`/admin/players`** → upload nuova lista quotazioni in mode **WIPE**  
   (disponibile solo con leghe=0 e tornei=0)
4. Ricrea leghe, invita utenti, rifai setup (§3)

**Non esiste archivio stagione automatico:** il wipe cancella i dati operativi. Esporta/classifiche a parte se ti servono.

---

## 8. Inviti coach e loghi squadra

### Coach (breve)

1. L’owner dalla pagina squadra **`/me/teams/[teamId]`** invita un’email
2. Il coach apre il link **`/me/coach-invites/[token]`** e accetta
3. Da quel momento può solo mettere la formazione (lega/torneo)
4. Non può toccare la rosa

### Loghi (breve)

- L’owner carica il logo dalla gestione squadra (`/me/teams/...`)
- Formato elaborato lato server (WebP); file troppo grandi possono fallire
- Se l’upload fallisce in produzione, di solito manca la configurazione storage (bucket/loghi) — segnalalo a chi gestisce l’hosting

---

## 9. Cosa può fare l’utente vs solo Admin

| Attività | User / Owner | Coach | Mister | Admin |
|----------|:------------:|:-----:|:------:|:-----:|
| Join lega, crea squadra | ✓ | | | ✓* |
| Costruire rosa (finché &lt; 25) | ✓ | | | ✓ |
| Modificare rosa a 25 (bloccata) | | | | ✓ |
| Formazione lega/torneo (se aperta) | ✓ | ✓ | | ✓** |
| Invito coach / logo | ✓ | | | |
| Pagelle XLS / voti giornata | | | ✓ | ✓ |
| Batch multi-lega dashboard | | | | ✓ |
| Crea leghe / tornei / permessi | | | | ✓ |
| Catalogo giocatori / wipe | | | | ✓ |
| CRUD rose admin | | | | ✓ |

\* Admin può creare leghe e gestire rose, non “gioca” al posto dell’utente salvo interventi di supporto.  
\*\* Admin può generare formazioni random o intervenire via hub; il flusso normale resta sugli utenti.

### Cosa l’app **non** fa (aspettative)

- Niente **mercato / asta**
- Niente notifiche automatiche di deadline (salvo l’invito coach)
- Niente apertura/chiusura giornata da sola: è sempre un click umano
- Niente storico stagioni: a fine anno si fa wipe e si riparte

---

## 10. Problemi comuni

### Timeout su batch o upload XLS

**Sintomo:** errore generico / pagina che “scade” dopo Apri/Chiudi/Calcola/Pubblica o dopo **Carica e propaga**.  
**Cosa fare:**

1. Non ripetere alla cieca dieci volte lo stesso mega-batch
2. Spezza: lavora su meno leghe, o usa i bottoni della **singola giornata**
3. Su `/admin/votes`: genera liste, poi importa; se serve ripeti per sottoinsiemi
4. Controlla il messaggio notice/error in alto: spesso indica quali leghe sono andate a buon fine

### Forfait / squadra senza formazione

**Sintomo:** “Vittoria a tavolino” / badge **RECUPERATA** / punti classifica strani (−1).  
**Cosa sapere:**

1. Alla chiusura, le formazioni mancanti vengono **recuperate** dall’ultima `USER` o `COACH` (se esiste) con −2 FP e −1 classifica
2. Forfait 3–0 solo se la squadra **non ha mai** schierato in quella lega
3. Prima di chiudere: `/admin/lineups` → chi manca (avvisa owner/coach)
4. “Genera formazioni” random è per test: non diventa fonte del recupero automatico (`AUTO_CARRIED` / `ADMIN_RANDOM` esclusi)

### Rosa bloccata a 25

**Sintomo:** l’owner non riesce ad aggiungere/togliere giocatori.  
**Normale:** a 25 la rosa è congelata.  
**Cosa fare:** Admin → `/admin/leagues/[lega]/teams` → squadra → roster → add/remove/replace.

### Voti che non matchano / tanti SV strani

1. Catalogo = quotazioni Fantacalcio (`/admin/players`)
2. File voti della giornata giusta, foglio **Fantacalcio**
3. Colonna **Cod.** presente e numerica
4. Formazioni chiuse e liste voti generate prima dell’import

### Mister non vede i bottoni batch

È voluto: Mister lavora per giornata + pagelle unificate. Per i batch multi-lega serve un Admin (o promuovere l’account da `/admin/permessi`).

### Lega non arriva a 10 / calendario non generabile

Servono 10 squadre e le regole A/R. Completa gli slot o gestisci le iscrizioni; poi genera calendario da schedule o batch.

### Torneo: serie ferma / nessuno avanza

1. Entrambe le gambe calcolate? (finale = una sola)
2. C’è un pareggio in attesa di **scelta vincitore** Admin?
3. Formazioni chiuse e voti completi sulla gamba corrente?

### Upload logo fallisce

Riduci dimensione file; se persiste, problema di storage lato server (non risolvibile dalla sola UI admin).

### WIPE LEGHE rifiutato

Devi prima completare **WIPE TORNEO**. Ordine: tornei → leghe → lista giocatori.

---

## 11. Checklist rapida

### Ogni turno di campionato

- [ ] Apri formazioni  
- [ ] Comunicata deadline  
- [ ] Controllato Hub formazioni  
- [ ] Chiudi formazioni  
- [ ] `/admin/votes` → XLS → Carica e propaga  
- [ ] Calcola punteggi e risultati  
- [ ] Controlla scores  
- [ ] Pubblica  
- [ ] Occhio classifica pubblica  

### Dopo la 18ª / torneo

- [ ] Crea torneo + password  
- [ ] Entries 4/8/16/32/64  
- [ ] Genera tabellone  
- [ ] Per ogni fase/gamba: apri → lineup → chiudi → XLS → calcola  
- [ ] Risolvi tie con seed / pick Admin  
- [ ] Finale solo andata  

### Fine anno

- [ ] `WIPE TORNEO`  
- [ ] `WIPE LEGHE`  
- [ ] Upload quotazioni in WIPE su `/admin/players`  
- [ ] Ricrea leghe e comunica password  

---

## Mappa percorsi (riferimento)

| Percorso | Uso |
|----------|-----|
| `/admin` | Dashboard, batch, wipe |
| `/admin/votes` | Pagelle XLS multi-lega |
| `/admin/lineups` | Stato formazioni |
| `/admin/players` | Catalogo quotazioni |
| `/admin/permessi` | Ruoli USER/MISTER/ADMIN |
| `/admin/leagues/new` | Nuova lega |
| `/admin/leagues/[id]/schedule` | Calendario / apri formazioni per giornata |
| `/admin/leagues/[id]/teams` | Squadre e ingresso rose admin |
| `/admin/teams/[id]/roster` | Modifica rosa admin |
| `/admin/matchdays/[id]` | Dettaglio giornata |
| `/admin/matchdays/[id]/votes` | Voti singola giornata |
| `/admin/matchdays/[id]/scores` | Punteggi |
| `/admin/tournaments` | Lista tornei |
| `/admin/tournaments/new` | Crea torneo |
| `/admin/tournaments/[id]/entries` | Iscrizioni / seeding |
| `/admin/tournaments/[id]/bracket` | Tabellone operativo |
| `/leagues/[id]/standings` | Classifica pubblica |
| `/me/teams/[id]` | Area owner (rosa, coach, logo) |
| `/me/coach-invites/[token]` | Accettazione coach |

---

*Documento allineato all’UI e alle decisioni prodotto attuali (dashboard batch, pagelle unificate, torneo A/R, wipe fine anno). Se un bottone in schermata ha un’etichetta leggermente diversa, segui il percorso indicato e il senso dell’azione.*
