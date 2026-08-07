# Regolamento ufficiale — Dream Team FC

Documento di regole per Admin, Mister e utenti.  
Allineato al comportamento dell’applicazione (motore di scoring, classifica, rose, formazioni, torneo).

**Manuale utente (owner/coach):** [MANUALE_UTENTE.md](./MANUALE_UTENTE.md)  
**Manuale operativo Admin/Mister:** [MANUALE_ADMIN.md](./MANUALE_ADMIN.md)  
**Indice docs admin:** [README.md](./README.md)

---

## 1. Rosa

### 1.1 Composizione obbligatoria

Ogni squadra deve avere esattamente **25 giocatori**, così ripartiti:

| Ruolo | Quantità |
|-------|----------|
| Portieri (P) | **3** |
| Difensori (D) | **8** |
| Centrocampisti (C) | **8** |
| Attaccanti (A) | **6** |
| **Totale** | **25** |

### 1.2 Blocco rosa (owner) e poteri Admin

- Il proprietario della squadra (**owner**) può aggiungere o rimuovere giocatori **solo finché la rosa ha meno di 25** giocatori.
- Quando il conteggio raggiunge **25**, la rosa è **congelata** per l’owner: non può più modificarla.
- L’**Admin** di piattaforma può sempre modificare la rosa (aggiungere, rimuovere, sostituire), anche dopo il blocco a 25.
- Coach e Mister **non** modificano le rose.

### 1.3 Esclusività in lega

Nella stessa lega, un giocatore reale può appartenere a **una sola** squadra fantasy.

- Non è consentito lo stesso giocatore in due rose della stessa lega.
- Lo stesso giocatore può invece figurare in rose di **leghe diverse**.

---

## 2. Formazione

### 2.1 Struttura (5 + 4)

Per ogni giornata di lega (o partita di torneo, quando le formazioni sono aperte) la formazione valida è:

- **5 titolari**
- **4 panchinari**
- **9 giocatori unici** in totale (nessun doppione tra titolari e panchina)

**Titolari**

- Esattamente **1 portiere**
- **4 di movimento** con almeno **1 D**, **1 C** e **1 A**
- Il quinto slot di movimento è **libero** tra D / C / A  
  (esempi validi: 1P-2D-1C-1A, 1P-1D-2C-1A, 1P-1D-1C-2A)

**Panchina**

- Esattamente **1 giocatore per ruolo**: 1P + 1D + 1C + 1A
- L’ordine di panchina **non** determina la priorità delle sostituzioni automatiche (il matching è solo per ruolo)

### 2.2 Sostituzioni automatiche

Al calcolo del punteggio squadra:

1. Se un **titolare** ha voto valido, il suo fantavoto conta.
2. Se un titolare è **SV** (senza voto / voto non valido), il motore cerca in panchina un sostituto **dello stesso ruolo** con fantavoto valido.
3. Al massimo **1 sostituzione automatica per ruolo** (quindi al massimo **4** a partita, una per P/D/C/A).
4. Se un secondo titolare dello stesso ruolo è SV, oppure manca un panchinaro dello stesso ruolo con voto valido, quel titolare resta in campo con **0** punti.

In sintesi: **stesso ruolo**, **max 1 sub per ruolo**, **SV senza sub → 0**.

---

## 3. Fantavoto e conversione in gol

### 3.1 Fantavoto del singolo giocatore

Formula base (giocatore non SV):

```text
fantavoto = voto base + bonus − malus
```

| Voce | Punti | Note |
|------|-------|------|
| Goal non da rigore (`gf`) | **+3** | Tutti; nel file XLS `Gf` non include i gol da rigore |
| Assist (`ass`) | **+1** | Tutti |
| Rigore parato (`rp`) | **+3** | Tipicamente portieri |
| Porta inviolata | **+1** | Solo portiere, se ha giocato (non SV) e `gs = 0` |
| Goal subito (`gs`) | **−1** | Solo portieri |
| Rigore sbagliato (`rs`) | **−3** | Tutti |
| Gol da rigore (`rf`) | **+3** | Tutti; additivo rispetto a `gf` (es. Gf=1 Rf=1 → +6) |
| Autogol (`au`) | **−2** | Tutti |
| Ammonizione (`amm`) | **−0,5** | Tutti |
| Espulsione (`esp`) | **−1** | Tutti |

- Voto con asterisco (es. `6*`) o giocatore assente dal file voti → **SV** (nessun fantavoto valido).
- Il **punteggio squadra** è la somma dei fantavoti dei 5 che contano dopo le sostituzioni automatiche.

### 3.2 Da fantapunti squadra a gol

```text
gol = se punteggio ≤ 25 → 0
     altrimenti → floor((punteggio − 25) / 2)
```

Esempi:

| Fantapunti squadra | Gol |
|--------------------|-----|
| 25 o meno | 0 |
| 26–26,9 | 0 |
| 27–28,9 | 1 |
| 29–30,9 | 2 |
| 31–32,9 | 3 |

La stessa formula vale per **lega** e **torneo**.

---

## 4. Formazione mancante alla chiusura

Alla **chiusura formazioni** (admin), se una squadra non ha schierato:

1. Se esiste almeno una formazione **USER o COACH** in precedenza nella stessa lega / stesso torneo → viene **recuperata** (stessa XI + panchina dell’ultima inserita). Non si copia da `AUTO_CARRIED` né da `ADMIN_RANDOM`.
2. Se non esiste alcuna formazione USER/COACH precedente → **forfait** (nessuna copia).

### 4.1 Formazione recuperata

- La partita si gioca normalmente con quella formazione.
- **−2 fantapunti** sul totale squadra **prima** della conversione in gol (il totale non scende sotto 0).
- In **lega**: anche **−1 punto** in classifica (anche in caso di vittoria; la classifica può andare sotto zero).
- In **torneo**: solo −2 fantapunti (non c’è classifica).
- Se un giocatore recuperato **non è più in rosa**, quello slot vale **SV** (0).
- Admin vede lo stato **INSERITA** / **MISTER** (allenatore) / **RECUPERATA** / **ADMIN** / **NON INSERITA**.

Esempio: 29 fantapunti lordi → 27 netti → **1** gol (non 2). Oppure 27 → 25 → **0** gol (non 1).

### 4.2 Forfait (nessuna formazione mai inserita in quella lega/torneo)

Nessun calcolo fantapunti sulla squadra assente. Risultato a tavolino:

| Situazione | Risultato a tavolino |
|------------|----------------------|
| Solo la **casa** ha formazione | **3–0** per la casa |
| Solo l’**ospite** ha formazione | **0–3** (vince l’ospite) |
| **Entrambe** senza formazione copiabile | **0–0** (doppio forfait) |

**Effetti in classifica (lega)**

- Vittoria a tavolino: **3 punti** a chi ha schierato (o ha formazione recuperata).
- Chi è in forfait: **0** dalla partita + **−1** penale classifica.
- Doppio forfait 0–0: **0** punti partita a entrambe (entrambe sconfitte) + **−1** classifica a entrambe.

---

## 5. Classifica di lega

Si considerano solo le partite in stato **PUBLISHED**.

### 5.1 Punti partita

- Vittoria: **3** punti  
- Pareggio: **1** punto ciascuna  
- Sconfitta: **0** punti  
- Doppio forfait: **0** punti dalla partita (vedi §4)
- Penali formazione (recuperata o forfait): **−1** aggiuntivo (vedi §4); la classifica **può** andare sotto zero

### 5.2 Criteri di ordinamento (tie-break)

In caso di parità, l’ordine è:

1. **Punti** di classifica (maggiori → meglio)
2. **Differenza reti** (gol fatti − gol subiti)
3. **Gol fatti**
4. **Fantapunti totali** (somma dei punteggi squadra nelle partite pubblicate)
5. In ultima istanza: nome squadra (ordine alfabetico italiano)

---

## 6. Torneo a eliminazione diretta

### 6.1 Dimensioni ammesse

Il tabellone deve avere esattamente una di queste dimensioni:

**4 · 8 · 16 · 32 · 64** squadre.

Fasi tipiche (dal tabellone più grande): Trentaduesimi → Sedicesimi → Ottavi → Quarti → Semifinali → Finale.

### 6.2 Seeding

All’iscrizione vengono salvati gli snapshot di classifica di provenienza:

- **seedPoints** — punti di lega
- **seedFantapunti** — fantapunti di lega

Il ranking di seeding ordina per **seedPoints** (poi nome).  
Accoppiamento **alto vs basso** (es. 1ª testa di serie vs ultima).

Nella **prima fase** non sono ammessi scontri tra squadre della **stessa lega** di provenienza (il sistema ripara gli accoppiamenti; se impossibile, va cambiata la selezione squadre).

### 6.3 Andata / ritorno e finale

- Tutte le fasi **tranne la finale**: serie di **andata e ritorno** (due “giornate” / leg).
- **Finale**: solo **andata** (una sola partita).

Formazioni e voti Fantacalcio sono gestiti **per fase e per leg** (andata e ritorno separati).

### 6.4 Avanzamento di serie

Vince la serie chi, sul totale delle partite della serie, prevale in ordine:

1. **Gol** complessivi (somma andata + ritorno, o sola finale)
2. **Fantapunti** complessivi
3. **seedPoints** (punti di lega allo snapshot di iscrizione)
4. **seedFantapunti** (fantapunti di lega allo snapshot)
5. Se resta parità totale → **scelta Admin** del vincitore

### 6.5 Blocco giornata successiva

Non è possibile aprire le formazioni della **giornata / leg successiva** se:

- la giornata precedente non è stata chiusa/completata nell’ordine previsto (andata → ritorno → fase successiva), oppure
- esistono serie terminate ancora **senza vincitore** (parità residua da risolvere a mano dall’Admin).

In pratica: **prima i vincitori di tutte le serie**, poi si apre la giornata successiva.

### 6.6 Formazione mancante e scoring in torneo

Valgono le regole di §4 (recupero ultima formazione **USER o COACH** dello stesso torneo, oppure forfait).  
In torneo si applicano solo **−2 fantapunti** sulla formazione recuperata (niente −1 classifica).  
Il risultato manuale Admin resta un override alternativo al calcolo da voti.

---

## 7. Ruolo Coach (allenatore)

- L’owner può **invitare** un coach sulla propria squadra (link / token).
- Il coach, dopo l’accettazione, può **solo impostare la formazione** della squadra che lo ha invitato (lega e torneo, quando aperte).
- Il coach **non** modifica la rosa, non gestisce la lega e non ha poteri Admin/Mister.

---

## 8. Riepilogo rapido

| Area | Regola chiave |
|------|----------------|
| Rosa | 25 = 3P+8D+8C+6A; lock owner a 25; Admin sempre |
| Esclusività | 1 giocatore → 1 sola squadra per lega |
| Formazione | 5+4; panchina 1 per ruolo |
| Auto-sub | Stesso ruolo; max 1/ruolo (max 4); senza sub → 0 |
| Gol | `≤25 → 0`, poi `floor((score−25)/2)` |
| Formazione mancante | Recupero ultima USER o COACH + −2 FP (−1 classifica in lega); altrimenti forfait 3–0 + −1 |
| Classifica | Punti (anche <0) → DR → gol fatti → fantapunti |
| Torneo | 4/8/16/32/64; A/R tranne finale; gol→FP→seed→Admin; solo −2 FP su recupero |
| Coach | Solo formazioni |

---

*Regolamento allineato al codice di scoring, standings, rose, lineup e torneo. Per le procedure operative (upload XLS, aperture giornate, wipe) vedere il [Manuale Admin](./MANUALE_ADMIN.md).*
