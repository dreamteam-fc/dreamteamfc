# Prompt Cursor Per Le Modifiche Dream Team FC

Questo file contiene un prompt riusabile per far partire Cursor con il contesto corretto.

## Prompt consigliato

```text
Agisci come senior software engineer sul repository corrente.

Prima di fare qualunque modifica, leggi nell'ordine:
- docs/CURSOR_HANDOFF/README.md
- docs/CURSOR_HANDOFF/02_STATO_ATTUALE_PROGETTO.md
- docs/CURSOR_HANDOFF/03_MAPPA_TECNICA.md
- docs/CURSOR_HANDOFF/05_ANALISI_MODIFICHE_DREAM_TEAM_FC.md
- docs/CURSOR_HANDOFF/06_PIANO_APPLICAZIONE_AL_PROGETTO.md

Contesto:
- il progetto Fantacalcetto e gia funzionante con auth, leghe, rose, lineup, voti, scoring, calendario e classifica
- non partire da zero
- non reintrodurre concetti gia superati se non esplicitamente richiesto
- il super admin e il ruolo centrale

Regole operative:
- ispeziona sempre prima i file reali coinvolti
- non modificare schema Prisma se non strettamente necessario per il task corrente
- se una richiesta del documento Dream Team FC e incoerente o ambigua, fermati e segnala il punto preciso prima di implementare
- non accorpare in un solo task modifiche di dominio troppo grandi
- preferisci implementazioni incrementali e verificabili

Priorita:
1. chiarire i requisiti incoerenti
2. implementare prima le modifiche piccole e ben definite
   (password lega, pannello voti, upload file voti, stato formazioni admin)
3. lasciare torneo cross-league e account allenatore come epic separati salvo richiesta esplicita

Alla fine di ogni task:
- elenca file modificati
- spiega l'impatto sul dominio attuale
- indica i comandi di verifica eseguiti
```

## Uso consigliato

Usa questo prompt:

- all'inizio di una nuova sessione Cursor
- prima di affrontare le modifiche del file Dream Team FC
- quando vuoi evitare che Cursor proponga refactor scollegati dall'architettura attuale
