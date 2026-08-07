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
   - Alla chiusura: auto-carry da ultima lineup `source=USER` (`auto-carry-matchday-lineups.ts`)  
   - Recuperata → −2 FP + −1 classifica; niente da copiare → forfait 3–0 + −1  
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
Tabella completa: `09_DECISIONI` / `docs/admin/REGOLAMENTO.md` §3.

**XLS Gf / Rf (chiuso 2026-08-07):** disgiunti e additivi  
- `Gf` = gol **non** da rigore → +3 ciascuno (`goals`)  
- `Rf` = gol da rigore → +3 ciascuno (`penaltiesScored`)  
- Esempio: Gf=1 Rf=1 → +6 (non “Rf già in Gf”)

Altri: Ass +1, Rp +3, Gs −1 (solo P), Rs −3, Au −2, Amm −0.5, Esp −1; clean sheet P se Gs=0.  
Voto con `*` → **SV**; assente dal file ma in lista → **SV**.  
Matching: **`Cod.` = `Player.externalId`**, source `fantacalcio-quotazioni`.

### Gol da score squadra

```ts
// lib/scoring/convert-score-to-goals.ts
goals = score <= 25 ? 0 : Math.floor((score - 25) / 2)
```

### Formazione mancante alla chiusura

| Caso | Lega | Torneo |
|------|------|--------|
| Ultima lineup `USER` esiste | Copia (`AUTO_CARRIED`) + **−2 FP** (prima dei gol, floor 0) + **−1** classifica | Copia + **−2 FP** (no classifica) |
| Mai schierato in quella lega/torneo | Forfait 3–0 + **−1** classifica | Forfait 3–0 |
| Giocatore fuori rosa in copia | Slot = **SV** | Idem |

Provenienza: `LineupSource` = `USER` \| `AUTO_CARRIED` \| `ADMIN_RANDOM`.  
Costanti: `lib/scoring/lineup-penalties.ts`.

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
| Formazioni | per `TournamentRound.lineupsStatus` DRAFT→OPEN→LOCKED; auto-carry da ultima `USER` **nel torneo** |
| Voti | XLS scoped a round/**leg** (andata ≠ ritorno) |
| Pareggio aggregato | seed migliore; residuo → admin pick |
| Libs | `lib/server/tournaments/*` — bracket, votes, calculate, pick winner, reset |

Flusso per fase/leg: apri → lineup → chiudi (auto-carry) → genera lista → XLS → calcola → (pick tie) → avanza.

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
