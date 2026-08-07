# Manuale utente — Dream Team FC / Fantacalcetto

Guida pratica per **owner** (proprietario squadra) e **allenatore (coach)**.  
Spiega come usare l’app giorno per giorno. Le regole di gioco complete sono nel [REGOLAMENTO.md](./REGOLAMENTO.md).

**Area personale:** `/me`  
**Leghe pubbliche:** `/leagues/...`  
**Tornei:** `/tournaments/...`  
**Manuale operatori (Admin/Mister):** [MANUALE_ADMIN.md](./MANUALE_ADMIN.md)

---

## Indice

1. [Chi sei nell’app](#1-chi-sei-nellapp)
2. [Primo accesso e area `/me`](#2-primo-accesso-e-area-me)
3. [Iscriverti a una lega e creare la squadra](#3-iscriverti-a-una-lega-e-creare-la-squadra)
4. [Rosa (25 giocatori)](#4-rosa-25-giocatori)
5. [Formazione di giornata](#5-formazione-di-giornata)
6. [Se dimentichi di schierare](#6-se-dimentichi-di-schierare)
7. [Classifica, calendario e risultati](#7-classifica-calendario-e-risultati)
8. [Allenatore (coach)](#8-allenatore-coach)
9. [Logo squadra](#9-logo-squadra)
10. [Torneo](#10-torneo)
11. [Problemi comuni](#11-problemi-comuni)
12. [Checklist settimanale](#12-checklist-settimanale)

---

## 1. Chi sei nell’app

| Ruolo | Cosa puoi fare |
|-------|----------------|
| **Owner** | Join lega, crea/gestisci squadra, rosa (fino a 25), formazioni, invita coach, logo |
| **Coach (allenatore)** | Solo formazioni della squadra che ti ha invitato (lega + torneo) |
| **Admin / Mister** | Operatori di stagione — vedi [MANUALE_ADMIN.md](./MANUALE_ADMIN.md) |

Non esiste un “admin di lega”: in lega sei **OWNER** della tua squadra o, se sei coach, gestisci solo le formazioni.

---

## 2. Primo accesso e area `/me`

1. Accedi con il tuo account  
2. Vai su **`/me`** — hub personale  

Da lì vedi tipicamente:

- Le tue **squadre** e la prossima giornata  
- Link rapidi a **formazione**, **rosa**, lega  
- Eventuali partite di **torneo** da schierare  

Consiglio: usa `/me` come home dopo ogni login.

**Installa l’app (PWA):** su Chrome/Edge desktop o Android usa *Installa app* / *Aggiungi a Home*; su iPhone Safari → Condividi → *Aggiungi a Home*.

---

## 3. Iscriverti a una lega e creare la squadra

1. Apri la lista leghe (`/leagues` o link che ti dà l’organizzatore)  
2. Entra nella lega scelta  
3. Inserisci la **password di iscrizione** (te la comunica l’Admin)  
4. Crea la tua **squadra fantasy** (nome, ecc.)  

Ogni lega ha **10 squadre**. Una sola squadra per utente per lega.

---

## 4. Rosa (25 giocatori)

Percorso: **`/me/teams/[tuaSquadra]/roster`** (anche dal dettaglio squadra).

### Composizione obbligatoria

| Ruolo | Quanti |
|-------|--------|
| Portieri (P) | 3 |
| Difensori (D) | 8 |
| Centrocampisti (C) | 8 |
| Attaccanti (A) | 6 |
| **Totale** | **25** |

### Regole importanti

- Nella **stessa lega** un giocatore reale può stare in **una sola** rosa  
- Puoi aggiungere/togliere giocatori **finché la rosa ha meno di 25**  
- A **25** la rosa è **bloccata** per te: per cambiare serve l’**Admin**  
- Completa la rosa **prima** di schierare: senza rosa valida non salvi la formazione  

---

## 5. Formazione di giornata

Percorso tipico:

1. `/me` oppure `/me/teams/[tuaSquadra]`  
2. Vai alla **giornata** con formazioni aperte  
3. **`/me/teams/.../matchdays/.../lineup`**

### Quando puoi modificare

Solo se lo stato giornata è **formazioni aperte** (`LINEUPS_OPEN`).  
Se vedi “Formazioni chiuse”, non puoi più salvare né eliminare.

### Cosa schierare

- **5 titolari:** 1P + almeno 1D, 1C, 1A + 1 libero tra D/C/A  
- **4 panchina:** 1P + 1D + 1C + 1A  

Poi **Salva formazione**.

### Eliminare la formazione

Nella stessa pagina, sezione **Formazione attuale**, usa **Elimina formazione** (solo a formazioni aperte).  
Poi puoi risalvare una nuova XI.

### Owner vs allenatore

- Se salva l’**owner** → in admin compare **INSERITA**  
- Se salva il **coach** → in admin compare **MISTER**  

Entrambe valgono come formazione “vera” (anche per eventuali recuperi automatici).

### Sostituzioni automatiche (in sintesi)

Se un titolare è **SV** (senza voto), entra il panchinaro **dello stesso ruolo** (max 1 sub per ruolo).  
Dettaglio: [REGOLAMENTO.md](./REGOLAMENTO.md) §2.

---

## 6. Se dimentichi di schierare

Alla **chiusura formazioni** (la fa Admin/Mister):

1. Se in passato hai già schierato in **quella lega** (tu o il coach) → viene **recuperata** l’ultima formazione inserita  
   - **−2 fantapunti** su quella partita  
   - **−1 punto** in classifica (anche se vinci)  
2. Se **non** hai mai schierato in quella lega → **forfait 3–0** + **−1** in classifica  

Quindi: meglio schierare ogni giornata; il recupero è una rete di sicurezza, non conviene basarcisi.

---

## 7. Classifica, calendario e risultati

Pagine pubbliche (anche senza login, se la lega è pubblica):

| Cosa | Dove |
|------|------|
| Info lega | `/leagues/[lega]` |
| Calendario | `/leagues/[lega]/schedule` |
| Classifica | `/leagues/[lega]/standings` |
| Giornata / risultati | `/leagues/[lega]/matchdays/[giornata]` |

I risultati e i punti classifica compaiono dopo che l’Admin **pubblica** la giornata.

---

## 8. Allenatore (coach)

### Se sei owner

Dal dettaglio squadra (`/me/teams/[tuaSquadra]`) puoi **invitare un coach** (link / token).  
Il coach potrà solo schierare: **non** tocca rosa né logo.

### Se sei coach

1. Apri il link di invito (`/me/coach-invites/[token]`) e accetta  
2. Da `/me` vedi la squadra che alleni  
3. Schieri come l’owner, sulle stesse pagine formazione  

---

## 9. Logo squadra

Solo l’**owner** (non il coach): dal dettaglio squadra carica/aggiorna il logo.  
Formato e dimensioni: segui i messaggi in pagina se l’upload fallisce.

---

## 10. Torneo

Se la tua squadra è iscritta a un torneo:

1. Controlla `/me` o `/tournaments/[id]`  
2. Se richiesto, **attiva** l’iscrizione con la password torneo  
3. Quando le formazioni della fase/gamba sono **aperte**, schiera da  
   `/me/teams/.../tournaments/fixtures/.../lineup`  

Regole simili alla lega (5+4).  
Se dimentichi: recupero dall’ultima formazione **USER/MISTER di quel torneo**, con **−2 fantapunti** (niente −1 classifica: in torneo non c’è classifica di lega).  
Se non hai mai schierato in quel torneo → forfait.

Dettaglio tabellone / avanzamento: [REGOLAMENTO.md](./REGOLAMENTO.md) §6.

---

## 11. Problemi comuni

### Non riesco a salvare la formazione

- Formazioni chiuse? Aspetta la prossima apertura  
- Rosa incompleta o non valida (non 25 / ruoli sbagliati)? Completa la rosa  
- Giocatore bloccato/non disponibile? Controlla messaggi di errore in pagina  

### Rosa bloccata a 25

Normale. Chiedi all’**Admin** una sostituzione.

### “Il giocatore è già in un’altra rosa”

Nella stessa lega è esclusivo. Scegline un altro.

### Non vedo i risultati

La giornata forse non è ancora **pubblicata**. Controlla più tardi o chiedi all’organizzatore.

### Sono coach e non posso cambiare la rosa

Voluto: il coach gestisce solo le formazioni.

---

## 12. Checklist settimanale

- [ ] Controllo `/me` e la prossima giornata  
- [ ] Formazioni **aperte**? Schiero (o faccio schierare il coach)  
- [ ] Controllo di aver **salvato** (vedo la formazione attuale)  
- [ ] Dopo la pubblicazione: controllo risultato e classifica  

---

## Link utili

| Documento | Contenuto |
|-----------|-----------|
| [REGOLAMENTO.md](./REGOLAMENTO.md) | Regole ufficiali (rosa, gol, forfait, torneo) |
| [MANUALE_ADMIN.md](./MANUALE_ADMIN.md) | Cosa fanno Admin e Mister |
| [README.md](./README.md) | Indice docs in questa cartella |
