# Guida per Cursor — Deploy Fantacalcetto su Railway con Supabase

**Aggiornata:** 1 agosto 2026  
**Progetto:** Fantacalcetto  
**Stack noto:** Next.js App Router, TypeScript, Prisma 6.19, PostgreSQL e Auth su Supabase  
**Obiettivo:** pubblicare l'app Next.js su Railway mantenendo database e autenticazione su Supabase.

---

## Come usare questo file

1. Copia questo file nella root del repository oppure in:
   `docs/CURSOR_HANDOFF/GUIDA_DEPLOY_RAILWAY.md`
2. Apri il repository in Cursor.
3. Avvia una nuova chat Agent e incolla il prompt seguente:

```text
Leggi integralmente GUIDA_CURSOR_DEPLOY_RAILWAY_SUPABASE.md e i documenti presenti
in docs/CURSOR_HANDOFF.

Agisci come senior DevOps engineer e senior Next.js engineer sul repository corrente.

Esegui autonomamente tutte le attività che puoi svolgere nel codice e nel terminale locale.
Quando è necessaria un'interazione umana, fermati e fammi UNA richiesta precisa alla volta,
indicando:
1. dove devo andare;
2. cosa devo fare;
3. quale dato devo restituirti;
4. come devo oscurare eventuali segreti.

Non inventare URL, chiavi, nomi di progetto, branch o stringhe di connessione.
Non mostrare mai credenziali complete nei messaggi o nei log.
Non eseguire comandi distruttivi e non fare push senza una mia conferma esplicita.

Inizia dalla Fase 0 e produci un breve report prima di passare alla fase successiva.
```

---

# 1. Regole obbligatorie per Cursor

## 1.1 Attività che Cursor può eseguire autonomamente

Cursor può, senza chiedere conferma per ogni singolo passaggio:

- leggere il repository e la documentazione di handoff;
- controllare `package.json`, lockfile, versione Node, Next.js e Prisma;
- controllare `next.config.*`;
- controllare `prisma/schema.prisma` e `prisma/migrations`;
- cercare tutte le variabili d'ambiente usate nel codice;
- controllare `.gitignore` e `.env.example`;
- creare o aggiornare file di configurazione non contenenti segreti;
- aggiungere un endpoint di health check non distruttivo;
- eseguire installazione dipendenze e controlli locali;
- eseguire build, lint, typecheck e test non distruttivi;
- preparare modifiche e mostrare il diff;
- preparare un commit, senza pubblicarlo finché l'utente non autorizza il push;
- analizzare i log di build o deploy forniti dall'utente.

## 1.2 Attività per cui Cursor deve fermarsi e chiedere all'utente

Cursor deve chiedere un'interazione umana prima di:

- accedere o autenticarsi su GitHub, Railway o Supabase;
- creare il progetto Railway dalla dashboard;
- collegare Railway al repository GitHub;
- inserire o leggere credenziali reali;
- ricevere `DATABASE_URL`, `DIRECT_URL` o chiavi Supabase;
- cambiare configurazioni Auth nella dashboard Supabase;
- generare o scegliere il dominio Railway;
- fare `git push`;
- eseguire migrazioni contro il database di produzione;
- eseguire seed o import dati sul database di produzione;
- promuovere un utente ad amministratore;
- cancellare, resettare o sovrascrivere dati;
- impostare un dominio personalizzato o modificare DNS.

## 1.3 Comandi vietati senza conferma esplicita

Non eseguire mai automaticamente:

```bash
npx prisma migrate reset
npx prisma db push
npx prisma migrate dev
npm run db:reset-leagues
npm run db:reset-leagues -- --confirm
git push --force
git reset --hard
git clean -fd
rm -rf
```

`prisma migrate dev` è ammesso solo sul database locale o di sviluppo, mai sul database di produzione.

## 1.4 Regole di sicurezza

- Non inserire valori reali in file versionati.
- Non committare `.env`, `.env.local` o copie contenenti segreti.
- Non stampare stringhe di connessione complete.
- Quando si mostra una variabile, mascherare password e chiavi:

```text
DATABASE_URL=postgresql://postgres.abc:***@aws-0-eu-...:6543/postgres
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_***ultime4
```

- Non usare mai una secret key o `service_role` in una variabile `NEXT_PUBLIC_*`.
- Le variabili `NEXT_PUBLIC_*` finiscono nel bundle browser.
- Non creare un database PostgreSQL su Railway: il database resta Supabase.
- Non modificare regole RLS o policy Supabase salvo che il codice lo richieda e l'utente approvi.

---

# 2. Risultato finale atteso

Il lavoro è completato solo quando:

- il repository compila localmente;
- le migrazioni Prisma esistenti risultano coerenti;
- Railway costruisce e avvia l'app;
- Railway espone un dominio HTTPS pubblico;
- il dominio di produzione è configurato in Supabase Auth;
- signup, conferma email, login, logout e recupero password non rimandano a localhost;
- l'app si collega al database Supabase;
- l'area pubblica funziona;
- un utente amministratore può accedere all'area admin;
- il flusso minimo dell'app è stato verificato;
- nessun segreto è presente nella cronologia Git.

---

# 3. Fase 0 — Ricognizione del repository

Cursor deve leggere prima:

```text
docs/CURSOR_HANDOFF/README.md
docs/CURSOR_HANDOFF/01_RIPARTENZA_DA_ZERO.md
docs/CURSOR_HANDOFF/02_STATO_ATTUALE_PROGETTO.md
docs/CURSOR_HANDOFF/03_MAPPA_TECNICA.md
docs/CURSOR_HANDOFF/04_CHECKLIST_OPERATIVA_CURSOR.md
package.json
next.config.js / next.config.mjs / next.config.ts
prisma/schema.prisma
.env.example
.gitignore
```

Deve poi eseguire controlli non distruttivi:

```bash
git status
git remote -v
git branch --show-current
node --version
npm --version
npm ci
npm run prisma:generate
npm run prisma:validate
npm run check:all
npm run build
```

Se uno script non esiste, Cursor non deve inventarne l'esecuzione: deve controllare
`package.json` e usare l'equivalente disponibile.

## Report richiesto al termine della Fase 0

Cursor deve riportare:

```text
- branch corrente:
- remote Git:
- working tree pulito oppure file modificati:
- versione Node:
- versione Next.js:
- versione Prisma:
- package manager e lockfile:
- comando di build:
- comando di start:
- stato build locale:
- variabili ambiente rilevate nel codice:
- stato migrations:
- problemi bloccanti:
- modifiche consigliate:
```

Non passare alla Fase 1 finché non è chiaro se la build locale funziona.

---

# 4. Fase 1 — Preparazione del codice per Railway

Cursor deve applicare il minimo numero possibile di modifiche.

## 4.1 Controllo degli script

Il `package.json` deve avere comandi equivalenti a:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "start": "node .next/standalone/server.js"
  }
}
```

Prima di modificare, controllare gli script esistenti.

Se il progetto usa l'output standalone, verificare che `next.config.*` contenga:

```ts
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
```

Non aggiungere `output: "standalone"` alla cieca. Controllare prima:

- eventuali configurazioni Next.js già presenti;
- monorepo o cartelle esterne;
- uso di un custom server;
- presenza di `public/` e asset statici;
- compatibilità con la versione Next.js installata.

La guida Railway attuale usa lo start command:

```bash
node .next/standalone/server.js
```

Se il progetto non usa standalone e `next start` funziona correttamente, Cursor deve
spiegare il motivo prima di cambiare strategia.

## 4.2 Build Prisma

La generazione di Prisma Client deve avvenire durante la build o in `postinstall`.

Configurazioni accettabili:

```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

oppure:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "next build"
  }
}
```

Non duplicare inutilmente i comandi.

## 4.3 Versione Node

Cursor deve controllare quale versione Node è supportata dalle dipendenze.

Se manca una versione esplicita, può proporre di aggiungere uno dei seguenti:

`.nvmrc`

```text
22
```

oppure in `package.json`:

```json
{
  "engines": {
    "node": ">=22 <23"
  }
}
```

Usare la versione realmente compatibile con il progetto. Non aggiornare Node, Next.js,
Prisma o altre dipendenze principali durante il deploy, salvo necessità documentata.

## 4.4 Health check

Cursor deve verificare se esiste già un endpoint pubblico leggero.

Se manca, può creare per App Router:

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "fantacalcetto",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
```

L'endpoint non deve:

- mostrare segreti;
- interrogare tabelle sensibili;
- richiedere autenticazione;
- eseguire scritture.

Il path consigliato su Railway sarà:

```text
/api/health
```

## 4.5 `.gitignore`

Verificare almeno:

```gitignore
.env
.env.local
.env.*.local
.env.production
.env.production.local
.next
node_modules
```

Non ignorare `.env.example`.

## 4.6 `.env.example`

Creare o aggiornare solo con placeholder:

```env
# Supabase PostgreSQL — runtime applicazione
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres"

# Connessione per Prisma Migrate, se usata da schema.prisma
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres"

# Supabase client
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_REPLACE_ME"

# Mantenere solo se il codice la usa ancora
NEXT_PUBLIC_SUPABASE_ANON_KEY="REPLACE_ME"

# Opzionali
API_FOOTBALL_KEY=""
API_FOOTBALL_SERIE_A_LEAGUE_ID=""
API_FOOTBALL_SEASON=""
API_FOOTBALL_REQUEST_DELAY_MS=""
API_FOOTBALL_MAX_TEAMS_PER_RUN=""
API_FOOTBALL_START_TEAM_INDEX=""
```

Non inserire un valore reale nemmeno temporaneamente.

---

# 5. Fase 2 — Contratto delle variabili d'ambiente

Cursor deve cercare nel repository:

```bash
rg -n "process\.env|DATABASE_URL|DIRECT_URL|SUPABASE|API_FOOTBALL" .
```

Escludere almeno:

```text
node_modules
.next
.git
```

Deve produrre una tabella con:

```text
VARIABILE | USATA IN | SERVER/CLIENT | OBBLIGATORIA | NOTE
```

## 5.1 Variabili principali

### `DATABASE_URL`

Usare la stringa **Transaction pooler** Supabase, normalmente sulla porta `6543`,
per il runtime dell'applicazione.

Schema indicativo:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
```

Cursor non deve inventare host, regione o project reference.

Query string richiesta (o equivalente con `sslmode=require&…`):

```text
?pgbouncer=true
```

Opzionale su Railway (singolo processo always-on): `&connection_limit=5`.
**Non** usare `connection_limit=1` sul runtime Railway: con un solo socket Prisma
le server action concorrenti (es. due “aggiungi giocatore” di fila) falliscono con
`Unable to start a transaction in the given time`. Su serverless il default resta 1.

Senza `pgbouncer=true` su `:6543`, Prisma + Supavisor transaction mode può fallire con
`42P05 prepared statement "sN" already exists`. L'app in `lib/database-url.ts`
aggiunge automaticamente `pgbouncer=true` e un `connection_limit` sensato se mancano,
ma la variabile Railway deve comunque essere corretta.

### `DIRECT_URL`

Per Prisma 6.19, se `schema.prisma` contiene:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

usare la stringa **Session pooler** Supabase, normalmente sulla porta `5432`.

Schema indicativo:

```env
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

La session mode è adatta alle migrazioni. Non aggiungere `DIRECT_URL` se non viene
usata dal progetto senza prima spiegare la modifica.

### `NEXT_PUBLIC_SUPABASE_URL`

```env
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
```

### `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Usare la publishable key Supabase:

```env
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Mantenere questa variabile solo se il codice la legge.

Cursor deve ispezionare `lib/supabase/*` e stabilire se:

- usa la nuova publishable key;
- usa ancora la legacy anon key;
- accetta una delle due come fallback.

Non sostituire automaticamente una legacy anon key con una publishable key senza
verificare il codice e la libreria Supabase installata.

## 5.2 Variabili da non esporre

Non devono mai avere prefisso `NEXT_PUBLIC_`:

```text
DATABASE_URL
DIRECT_URL
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
API_FOOTBALL_KEY
```

## 5.3 Variabili pubbliche e build Next.js

Le variabili `NEXT_PUBLIC_*` vengono incorporate nella build client. Dopo una loro
modifica su Railway è necessario un nuovo deploy.

---

# 6. Gate umano A — Recupero credenziali Supabase

Dopo avere completato il codice e i controlli locali, Cursor deve fermarsi e chiedere
esattamente:

```text
Ho completato la preparazione locale.

Ora apri il progetto Supabase e recupera questi valori:

1. Connect → Transaction pooler URI, porta 6543
2. Connect → Session pooler URI, porta 5432, se il progetto usa DIRECT_URL
3. Settings → API Keys → Project URL
4. Settings → API Keys → Publishable key
5. Legacy anon key solo se il codice la richiede davvero

Non incollare qui password o URI complete se la chat non è privata.
Puoi inserirle direttamente nel file .env.local e rispondermi soltanto “fatto”.
Se devo controllare il formato, sostituisci la password con ***.
```

Cursor deve poi verificare localmente solo la presenza delle variabili, senza stamparne
il valore.

Esempio di controllo sicuro mediante script Node:

```js
const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

for (const key of required) {
  console.log(`${key}: ${process.env[key] ? "presente" : "mancante"}`);
}
```

---

# 7. Fase 3 — Verifiche locali con il nuovo Supabase

Dopo che l'utente ha inserito le credenziali in `.env.local`, Cursor deve eseguire:

```bash
npm run prisma:generate
npm run prisma:validate
npx prisma migrate status
npm run build
```

Prima di applicare migrazioni al nuovo database, deve mostrare:

- numero di migrazioni presenti;
- migrazioni pending;
- eventuali errori;
- database target mascherato;
- comando che intende eseguire.

Poi deve chiedere:

```text
Il nuovo database Supabase risulta raggiungibile e ci sono N migrazioni da applicare.
Autorizzi l'esecuzione di `npx prisma migrate deploy` sul nuovo progetto Supabase?
```

Solo dopo conferma:

```bash
npx prisma migrate deploy
```

Dopo l'esecuzione:

```bash
npx prisma migrate status
```

## Seed

Il seed non deve far parte di ogni deploy.

Prima di eseguire:

```bash
npm run db:seed
npm run players:import-demo
```

Cursor deve spiegare cosa verrà creato e chiedere conferma.

Non eseguire automaticamente import API-Football.

---

# 8. Gate umano B — GitHub

Cursor deve verificare:

```bash
git remote -v
git branch --show-current
git status
git diff --check
```

Se il remote atteso è:

```text
fantacalcettotest/fantacalcetto
```

deve comunque mostrarlo all'utente per conferma.

Può preparare il commit:

```bash
git add <solo-file-intenzionali>
git commit -m "Prepare Railway production deployment"
```

Prima del push deve chiedere:

```text
Le modifiche locali sono pronte e i controlli passano.
Il commit è <hash-breve> sul branch <branch>.
Autorizzi `git push origin <branch>`?
```

Non usare `git add .` se sono presenti file non correlati o segreti.

Prima del push, eseguire una ricerca di possibili segreti:

```bash
git grep -n -I -E \
  'postgres(ql)?://|sb_secret_|service_role|SUPABASE_SERVICE_ROLE|API_FOOTBALL_KEY='
```

Analizzare i risultati senza mostrare valori completi.

---

# 9. Gate umano C — Creazione del progetto Railway

Dopo il push, Cursor deve chiedere all'utente di svolgere questi passaggi:

```text
1. Accedi a Railway.
2. Seleziona New Project.
3. Seleziona Deploy from GitHub Repo.
4. Collega GitHub, se richiesto.
5. Seleziona il repository fantacalcettotest/fantacalcetto.
6. Seleziona Add Variables, non creare un database Railway.
7. Dimmi quando vedi il servizio Next.js nella dashboard.
```

Se Railway chiede il branch, usare quello confermato nella fase Git.

Cursor non deve chiedere screenshot con segreti visibili.

---

# 10. Gate umano D — Variabili Railway

Cursor deve consegnare all'utente questo template, senza valori:

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Aggiungere solo le altre variabili effettivamente obbligatorie emerse dal codice.

Istruzione all'utente:

```text
Nel servizio Railway apri Variables → RAW Editor.
Incolla i valori reali prelevati dal tuo `.env.local`.
Non inviarmeli in chiaro.
Quando hai salvato, rispondi “variabili Railway inserite”.
```

Non aggiungere manualmente:

```env
PORT=
NODE_ENV=
```

salvo necessità verificata. Railway assegna la porta all'app.

---

# 11. Configurazione Railway proposta

Cursor deve guidare l'utente nella dashboard.

## 11.1 Build command

Lasciare l'autodetection Railpack se funziona.

Se serve un comando esplicito:

```bash
npm run build
```

## 11.2 Start command

Se è stato configurato standalone:

```bash
npm run start
```

con script:

```json
{
  "start": "node .next/standalone/server.js"
}
```

Altrimenti usare lo start command realmente verificato dal progetto.

## 11.3 Pre-deploy command

Impostare:

```bash
npx prisma migrate deploy
```

I seed e gli import non devono essere nel pre-deploy command.

## 11.4 Healthcheck

Impostare, se l'endpoint è stato creato:

```text
/api/health
```

L'endpoint deve restituire HTTP `200`.

## 11.5 Root directory

Se il repository è un monorepo, Cursor deve individuare la cartella che contiene
`package.json` e chiedere all'utente di impostarla come Root Directory.

Se non è un monorepo, non impostare una root directory personalizzata.

---

# 12. Primo deploy Railway

Cursor deve chiedere all'utente di avviare il deploy e poi di fornire:

- stato finale: Success oppure Failed;
- ultima parte dei log, senza segreti;
- eventuale codice errore;
- URL del deployment solo se già pubblico.

Quando analizza i log deve distinguere:

1. installazione dipendenze;
2. Prisma generate;
3. Next.js build;
4. pre-deploy migration;
5. avvio server;
6. healthcheck.

Non proporre modifiche casuali. Correggere una causa alla volta.

---

# 13. Gate umano E — Dominio Railway

Quando il deploy è funzionante:

```text
Nel servizio Railway apri Settings → Networking/Public Networking.
Genera un dominio Railway.
Incollami solo il dominio pubblico, per esempio:
https://nome-app.up.railway.app
```

Il dominio non è un segreto.

Cursor deve salvare il dominio come:

```text
PRODUCTION_URL=https://...
```

Questa etichetta serve nel report, non necessariamente come variabile dell'app.

---

# 14. Gate umano F — Supabase Auth

Cursor deve prima cercare nel codice:

```bash
rg -n "redirectTo|emailRedirectTo|auth/callback|forgot-password|reset-password|signUp|signInWithOAuth" app lib
```

Deve elencare i path reali usati dall'app.

Poi deve chiedere all'utente:

```text
Apri Supabase → Authentication → URL Configuration.

Imposta Site URL:
<DOMINIO_RAILWAY>

Aggiungi nelle Redirect URLs gli URL esatti individuati nel codice.

Mantieni anche per lo sviluppo locale:
http://localhost:3000/**

Non rimuovere altri redirect ancora necessari.
Dimmi quando hai salvato.
```

Esempi possibili, da usare solo se esistono realmente nel codice:

```text
https://DOMINIO_RAILWAY/auth/callback
https://DOMINIO_RAILWAY/reset-password
https://DOMINIO_RAILWAY/**
```

Preferire URL esatti. Usare wildcard temporanei solo durante il collaudo e restringerli
dopo i test.

---

# 15. Fase 4 — Creazione admin e dati iniziali

## 15.1 Creazione utente

L'utente deve creare l'account dall'app pubblicata, normalmente tramite:

```text
/signup
```

Cursor deve chiedere solo:

```text
Crea l'utente amministratore dall'app online e completa l'eventuale conferma email.
Quando riesci a effettuare il login, dimmelo senza comunicarmi la password.
```

## 15.2 Collegamento amministratore

Prima di eseguire:

```bash
npm run auth:link-admin
```

Cursor deve leggere lo script e chiarire:

- come identifica l'utente;
- se richiede email, ID Auth o altre variabili;
- quali record modifica;
- se è idempotente.

Deve poi chiedere all'utente il solo identificatore necessario, mai la password.

L'esecuzione contro produzione richiede conferma esplicita.

## 15.3 Seed e giocatori demo

Eseguire una sola volta e solo se richiesto:

```bash
npm run db:seed
npm run players:import-demo
```

Non inserire questi comandi nel ciclo automatico di deploy.

---

# 16. Fase 5 — Collaudo produzione

Cursor deve guidare il test in quest'ordine.

## 16.1 Infrastruttura

- `GET /api/health` restituisce 200;
- homepage raggiungibile in HTTPS;
- nessun redirect a localhost;
- nessun errore Prisma nei log;
- nessun segreto nel browser o nei log pubblici.

## 16.2 Auth

- signup;
- conferma email;
- login;
- logout;
- password dimenticata;
- reset password;
- sessione conservata;
- route admin protette.

## 16.3 Funzioni Fantacalcetto

Ordine minimo:

1. login amministratore;
2. accesso `/admin`;
3. creazione lega;
4. signup/login utente normale;
5. join lega;
6. creazione squadra;
7. gestione rosa;
8. generazione calendario;
9. apertura formazioni;
10. salvataggio formazione;
11. inserimento voti;
12. calcolo punteggi;
13. pubblicazione giornata;
14. verifica calendario e classifica pubblici.

## 16.4 Mobile

Controllare almeno:

- homepage;
- login/signup;
- pagina squadra;
- rosa;
- formazione;
- voti admin;
- classifica.

---

# 17. Diagnostica errori frequenti

## `Application failed to respond`

Controllare:

- start command;
- processo in ascolto sulla porta fornita da Railway;
- build terminata correttamente;
- healthcheck;
- presenza del server standalone se lo start lo richiede.

Non impostare una porta fissa nel codice.

## `Cannot find module .next/standalone/server.js`

Cause possibili:

- manca `output: "standalone"`;
- la build non è stata completata;
- start command incoerente;
- monorepo/root directory errata.

## Prisma `P1000`

Autenticazione database fallita:

- password errata;
- password non URL-encoded;
- username o project ref errati.

Non chiedere all'utente di incollare la password in chiaro.

## Prisma `P1001`

Database non raggiungibile:

- host o porta errati;
- stringa direct invece del pooler in ambiente IPv4;
- progetto Supabase sospeso;
- network temporaneamente non disponibile.

## Errori di prepared statement o pooler

Errore tipico: `42P05 prepared statement "s3" already exists`.

Controllare:

- `DATABASE_URL` = transaction pooler porta **6543** con `pgbouncer=true` (su Railway: `connection_limit` assente o `~5`, mai `1`);
- non usare Session `:5432` come `DATABASE_URL` runtime su Railway Free;
- `DIRECT_URL` = Session `:5432` solo per migrate (senza `pgbouncer=true`);
- l'app normalizza `:6543` in `lib/database-url.ts` / `lib/prisma.ts` se il flag manca.

## Redirect a localhost

Controllare:

- Supabase Site URL;
- Redirect URLs;
- `redirectTo` nel codice;
- variabili `NEXT_PUBLIC_*`;
- nuovo deploy dopo modifica delle variabili pubbliche.

## Chiavi Supabase `undefined`

Controllare:

- nome esatto della variabile;
- uso publishable vs legacy anon;
- disponibilità della variabile durante la build;
- redeploy dopo modifica.

## Migrazione fallita

Non usare subito `migrate reset` o `db push`.

Eseguire:

```bash
npx prisma migrate status
```

Analizzare la migrazione fallita e proporre una strategia esplicita. Qualunque
`prisma migrate resolve` richiede spiegazione e conferma umana.

---

# 18. Formato dei report di Cursor

Al termine di ogni fase, Cursor deve usare:

```text
FASE:
STATO: completata / bloccata / fallita

MODIFICHE:
- ...

CONTROLLI ESEGUITI:
- comando:
- esito:

RISCHI O NOTE:
- ...

INTERAZIONE UMANA NECESSARIA:
- nessuna
oppure
- una sola azione precisa
```

## Report finale

```text
DEPLOY FANTACALCETTO — REPORT FINALE

Repository:
Branch:
Commit:
Railway project/service:
Production URL:
Supabase project ref mascherato:
Build:
Migrations:
Healthcheck:
Auth:
Admin:
Test funzionali:
Problemi residui:
Azioni consigliate:
```

Non scrivere “tutto funzionante” se non sono stati realmente verificati almeno build,
healthcheck, connessione database e login.

---

# 19. Checklist sintetica

```text
[ ] Letti handoff e file principali
[ ] Working tree controllato
[ ] Dipendenze installate
[ ] Prisma generate e validate superati
[ ] Build locale superata
[ ] Script build/start verificati
[ ] Configurazione standalone verificata o motivatamente esclusa
[ ] Health endpoint disponibile
[ ] .gitignore sicuro
[ ] .env.example senza segreti
[ ] Variabili ambiente mappate
[ ] Nuovo Supabase raggiungibile
[ ] Migrazioni applicate con migrate deploy
[ ] Seed eseguito solo se autorizzato
[ ] Nessun segreto in Git
[ ] Commit preparato
[ ] Push autorizzato
[ ] Railway collegato al repository
[ ] Variabili Railway inserite dall'utente
[ ] Pre-deploy command configurato
[ ] Healthcheck Railway configurato
[ ] Primo deploy riuscito
[ ] Dominio Railway generato
[ ] Supabase Site URL aggiornato
[ ] Redirect URLs aggiornati
[ ] Nuovo deploy dopo env pubbliche
[ ] Signup/login/reset verificati
[ ] Admin collegato
[ ] Flusso Fantacalcetto minimo verificato
```

---

# 20. Riferimenti ufficiali

- Railway — Deploy Next.js:  
  https://docs.railway.com/guides/nextjs
- Railway — Variabili:  
  https://docs.railway.com/variables
- Railway — Pre-deploy command:  
  https://docs.railway.com/deployments/pre-deploy-command
- Railway — Healthchecks:  
  https://docs.railway.com/deployments/healthchecks
- Railway — Domini:  
  https://docs.railway.com/networking/domains/working-with-domains
- Supabase — Connessione PostgreSQL:  
  https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase — Prisma:  
  https://supabase.com/docs/guides/database/prisma
- Supabase — Redirect URLs Auth:  
  https://supabase.com/docs/guides/auth/redirect-urls
- Supabase — API keys:  
  https://supabase.com/docs/guides/getting-started/api-keys
- Prisma — Migrazioni sviluppo e produzione:  
  https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- Prisma — `migrate deploy`:  
  https://www.prisma.io/docs/cli/migrate/deploy
- Next.js — Deploy e standalone output:  
  https://nextjs.org/docs/app/getting-started/deploying
