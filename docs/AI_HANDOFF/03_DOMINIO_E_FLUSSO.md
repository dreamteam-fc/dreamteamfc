# 03 — Dominio e flussi

Decisioni chiuse: [`../CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md`](../CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md).  
Implementazione: `prisma/schema.prisma` + `lib/server/*`.

---

## Entità chiave (mental model)

```
User (USER|MISTER|ADMIN)
  └─ LeagueMember (OWNER|MEMBER) → League (maxTeams=10, password)
       └─ FantasyTeam → FantasyRoster (25, unique per leagueId+playerId)
            └─ Lineup / LineupPlayer per Matchday
                 └─ votes → TeamScore → FantasyFixture → standings

Player (source=fantacalcio-quotazioni, externalId=Cod.)

Tournament (entries cross-league)
  └─ TournamentRound (lineupsStatus DRAFT|OPEN|LOCKED)
       └─ TournamentFixture (legs andata/ritorno; finale 1 leg)
            └─ TournamentLineup → votes scoped al round/leg
```

---

## Lega (campionato)

### Regole fisse

| Regola | Valore | Codice |
|--------|--------|--------|
| Squadre | **10** obbligatorie | `lib/server/admin/create-league.ts` + schema |
| Calendario | solo A/R → **18** giornate | `lib/server/schedules/*` |
| Rosa | **25** = 3P+8D+8C+6A | `validate-roster-composition.ts` |
| Esclusività | 1 player / lega | `FantasyRoster @@unique([leagueId, playerId])` |
| Lock rosa | count ≥ 25 → solo Admin | `roster-edit-policy.ts` |
| Lineup | **5** titolari + **4** panchina (1/ruolo) | `validate-lineup-composition.ts` |
| Auto-sub | stesso ruolo; max 1/ruolo (max 4) | `League.maxAutoSubs` default 4 |
| Password lega | obbligatoria | hash server-side |
| LeagueRole | solo OWNER \| MEMBER | niente “admin di lega” |

### Flusso giornata (operatore)

1. Apri formazioni (`Matchday` / batch) — `open-matchday-lineups.ts` / `open-all-lineups.ts`  
2. Utenti/coach schierano (`app/me/...`)  
3. Chiudi formazioni — `lock-matchday-lineups.ts` / `lock-all-lineups.ts`  
4. Genera lista voti richiesti — `generate-required-vote-players.ts`  
5. Upload XLS Fantacalcio — `lib/server/votes/*` + UI `/admin/votes`  
6. Calcola punteggi + risultati fixture — `calculate-matchday-scores.ts`, `calculate-fantasy-fixture-results.ts`  
7. Pubblica — `publish-matchday.ts` / `publish-all-matchdays.ts`  
8. Classifica pubblica — `calculate-league-standings.ts` → `/leagues/[id]/standings`

**Niente cron:** se l’operatore non clicca, la giornata resta ferma.

---

## Scoring

### Fantavoto giocatore

`lib/scoring/calculate-fantavote.ts` — `baseVote + bonus − malus`  
Tabella codici XLS (gf/ass/rp/gs/rs/rf/au/amm/esp + clean sheet P): vedi `09_DECISIONI`.

- Voto con `*` (es. `6*`) → **SV**  
- Assente dal file ma in lista richiesta → **SV**  
- Matching: **`Cod.` = `Player.externalId`**, source canonica `fantacalcio-quotazioni`

### Gol da score squadra

```ts
// lib/scoring/convert-score-to-goals.ts
goals = score <= 25 ? 0 : Math.floor((score - 25) / 2)
```

### Auto-sub

Dopo lock: titolare SV → entra panchina **stesso ruolo** (max 1 per ruolo).  
Manca panchina stesso ruolo → titolare resta 0.

---

## Torneo (cross-league)

V1 operativa. Route admin: `/admin/tournaments/*`. User lineup: `/me/teams/[teamId]/tournaments/fixtures/.../lineup`.

| Aspetto | Regola |
|---------|--------|
| Size bracket | 4 / 8 / 16 / 32 / 64 |
| Entries | manuali (squadra + lega), password |
| Seeding | alto ↔ basso; 1ª fase no stessa lega |
| Serie | A/R salvo **finale** (1 leg) |
| Formazioni | per `TournamentRound.lineupsStatus` DRAFT→OPEN→LOCKED |
| Voti | XLS scoped a round/**leg** (andata ≠ ritorno) |
| Pareggio aggregato | seed migliore; residuo → admin pick |
| Libs | `lib/server/tournaments/*` — bracket, votes, calculate, pick winner, reset |

Flusso per fase/leg: apri → lineup → chiudi → genera lista → XLS → calcola → (pick tie) → avanza.

---

## Coach

- Invite email → token → accept (`TeamCoachInvite` / `TeamCoach`)  
- Può **solo** formazione (lega + torneo) della squadra invitante  
- **Non** modifica rosa  
- UI: `/me/teams/[teamId]`, `/me/coach-invites/[token]`

---

## Catalogo Player

- Canonico: `source = fantacalcio-quotazioni`, `externalId` = Cod. Fantacalcio  
- UI: `/admin/players` — SYNC (default se leghe/tornei esistono) / WIPE (solo se zero leghe e zero tornei)  
- Sync: `lib/server/players/sync-fantacalcio-quotazioni-catalog.ts`  
- Legacy script API-Football/demo: non usare per matching voti stagione live

---

## Fuori perimetro (non implementare “per sbaglio”)

- Asta / mercato trasferimenti  
- Notifiche push/email automatiche (oltre invite coach)  
- Archivio stagioni (oggi: wipe distruttivo fine anno)  
- Cron apri/chiudi giornata
