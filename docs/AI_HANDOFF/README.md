# AI Handoff — Fantacalcetto / Dream Team FC

Pack operativo per coding agent. **Non** è marketing: mappa minima per mettere le mani nel posto giusto senza reinventare regole già chiuse.

**Repo:** `https://github.com/dreamteam-fc/dreamteamfc.git` (`main`)  
**Workspace tipico:** `C:\Users\mailg\fantacalcetto`  
**Lingua codice/UI mista** IT; questo pack è in italiano.

---

## Come usare questo pack

1. Leggi questo README (2 min).
2. Skimma `05_REGOLE_CRITICHE.md` **prima** di toccare Prisma/Docker/deploy.
3. Per capire dominio: `03_DOMINIO_E_FLUSSO.md`.
4. Per trovare file: `02_MAPPA_REPO.md` + `06_DOVE_METTERE_MANO.md`.
5. Solo se serve contesto storico/ops lungo → documenti esterni sotto (attenzione al drift).

Ordine consigliato se parti da zero nella sessione:

| # | File | Perché |
|---|------|--------|
| 1 | [01_STACK_E_DEPLOY.md](./01_STACK_E_DEPLOY.md) | Stack, env, Railway |
| 2 | [02_MAPPA_REPO.md](./02_MAPPA_REPO.md) | Dove vivono le cose |
| 3 | [03_DOMINIO_E_FLUSSO.md](./03_DOMINIO_E_FLUSSO.md) | Lega / torneo / scoring |
| 4 | [04_ADMIN_E_DATI.md](./04_ADMIN_E_DATI.md) | Batch, XLS, wipe, catalogo |
| 5 | [05_REGOLE_CRITICHE.md](./05_REGOLE_CRITICHE.md) | DO/DON'T infrangibili |
| 6 | [06_DOVE_METTERE_MANO.md](./06_DOVE_METTERE_MANO.md) | Cookbook “se vuoi X → Y” |

---

## Cos’è il prodotto (1 paragrafo)

Fantacalcio a **5 calcetto** (rosa 25, lineup 5+4) su leghe da **10 squadre**, calendario A/R **18 giornate**, voti da **XLS Fantacalcio** (`Cod.` = `externalId`). Operatore-driven: Admin/Mister aprono/chiudono formazioni, importano voti, calcolano, pubblicano. Torneo cross-league a eliminazione (gambe andata/ritorno) post-campionato. **Niente** asta/mercato, **niente** cron automatico.

---

## Fonte di verità (priorità)

| Priorità | Fonte | Nota |
|----------|-------|------|
| 1 | **Codice** (`prisma/`, `lib/server/`, `app/*/actions.ts`) | Sempre |
| 2 | Questo pack `docs/AI_HANDOFF/` | Mappa agent-oriented |
| 3 | [`../ANALISI_STATO_PROGETTO_2026-08-05.md`](../ANALISI_STATO_PROGETTO_2026-08-05.md) | Audit onesto stato/risk |
| 4 | [`../CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md`](../CURSOR_HANDOFF/09_DECISIONI_PRODOTTO_CHIUSE.md) | Regole prodotto chiuse |
| 5 | [`../CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md`](../CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md) | Deploy dettagliato |

**Drift noto:** `CURSOR_HANDOFF/02_*`, `03_*` (lineup 5+3, rosa 8), pezzi di `08_*`, `QA_MANUALE.md` possono essere obsoleti. Non ripristinare regole vecchie.

---

## Ruoli in una riga

- **USER** — join lega, rosa, lineup, coach invite, torneo lineup  
- **MISTER** — `/admin` (link da `/me`) + pagelle XLS + batch **Apri/Chiudi formazioni (tutte)** + ops per giornata; no wipe/tornei/crea lega/giocatori/permessi/random/calendari/calcola-pubblica batch  
- **ADMIN** — platform (`canManagePlatform`): batch restanti, catalogo, wipe, tornei, crea leghe  
- **Admin principale** (`dreamteamfc@proton.me` / `PRIMARY_ADMIN_EMAIL`) — unico con `/admin/permessi`  

Non confondere **Mister** (ruolo piattaforma) con **allenatore** TeamCoach (badge formazione **MISTER**). Dettaglio: `lib/auth/app-roles.ts`, `04_ADMIN_E_DATI.md`.

---

## Checklist mentale prima di un PR

- [ ] Non rompere pairing `DATABASE_URL` :6543 / `DIRECT_URL` :5432  
- [ ] Non reintrodurre `$transaction` interattive lunghe su path write pesanti  
- [ ] Non mutare Next pin via `npm install` in `/app` nel Dockerfile  
- [ ] Matching voti solo `Cod.` ↔ `externalId` (`fantacalcio-quotazioni`)  
- [ ] Rosa 25 / lineup 5+4 / maxTeams 10 — già nel codice, non “documentare altro”  
- [ ] Gf e Rf entrambi +3 (non trattare Rf come già in Gf)  
- [ ] Lock formazioni: auto-carry / forfait + penali — non “solo forfeit sempre”  
- [ ] SoT regole: `docs/admin/REGOLAMENTO.md` + `09_DECISIONI` + questo pack  
