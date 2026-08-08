import type { Metadata } from "next";
import Link from "next/link";

import { BrandHeader } from "@/components/brand/brand-header";

export const metadata: Metadata = {
  title: "Regolamento | Dream Team FC",
  description:
    "Regole ufficiali di Dream Team FC: rosa, formazione, fantavoto, classifica e torneo."
};

const toc = [
  { href: "#rosa", label: "Rosa" },
  { href: "#formazione", label: "Formazione" },
  { href: "#fantavoto", label: "Fantavoto e gol" },
  { href: "#formazione-mancante", label: "Formazione mancante" },
  { href: "#classifica", label: "Classifica" },
  { href: "#torneo", label: "Torneo" },
  { href: "#coach", label: "Allenatore" },
  { href: "#riepilogo", label: "Riepilogo" }
] as const;

function Section({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="surface-card scroll-mt-6 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-brand-ink">
        {title}
      </h2>
      <div className="mt-5 space-y-5 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-brand-ink sm:text-lg">
      {children}
    </h3>
  );
}

function RuleList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function RegolamentoPage() {
  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <BrandHeader
          title="Regolamento"
          description="Le regole ufficiali di Dream Team FC: come funziona la rosa, la formazione, i fantavoti, la classifica e i tornei."
          actions={
            <>
              <Link
                href="/"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Home
              </Link>
              <Link
                href="/come-giocare"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Come giocare
              </Link>
            </>
          }
        />

        <nav
          aria-label="Indice del regolamento"
          className="surface-card p-5 sm:p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">
            Indice
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {toc.map((item, index) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-fog hover:text-brand-blue"
                >
                  <span className="font-display text-sm font-bold text-brand-blue">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="rosa" title="1. Rosa">
          <div className="space-y-3">
            <Subheading>Composizione</Subheading>
            <p>
              Ogni squadra deve avere esattamente <strong>25 giocatori</strong>:
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-fog/80 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ruolo</th>
                    <th className="px-4 py-3 font-semibold">Quantità</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Portieri (P)</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">3</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Difensori (D)</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">8</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Centrocampisti (C)</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">8</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Attaccanti (A)</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">6</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <Subheading>Blocco rosa</Subheading>
            <RuleList
              items={[
                <>
                  Il proprietario della squadra può aggiungere o rimuovere
                  giocatori <strong>solo finché la rosa ha meno di 25</strong>.
                </>,
                <>
                  A 25 giocatori la rosa è <strong>congelata</strong>: l&apos;owner
                  non può più modificarla.
                </>,
                <>
                  L&apos;admin di piattaforma può sempre intervenire sulla rosa,
                  anche dopo il blocco.
                </>,
                <>Allenatore e Mister non modificano le rose.</>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>Esclusività in lega</Subheading>
            <p>
              Nella stessa lega un giocatore reale può appartenere a{" "}
              <strong>una sola</strong> squadra fantasy. Può invece figurare in
              rose di leghe diverse.
            </p>
          </div>
        </Section>

        <Section id="formazione" title="2. Formazione">
          <div className="space-y-3">
            <Subheading>Struttura (5 + 4)</Subheading>
            <p>
              Per ogni giornata di lega (o partita di torneo, quando le
              formazioni sono aperte) serve una formazione valida con{" "}
              <strong>5 titolari</strong> e <strong>4 panchinari</strong> —{" "}
              <strong>9 giocatori unici</strong>, senza doppioni.
            </p>
            <p className="font-medium text-brand-ink">Titolari</p>
            <RuleList
              items={[
                <>Esattamente <strong>1 portiere</strong></>,
                <>
                  <strong>4 di movimento</strong> con almeno 1 D, 1 C e 1 A
                </>,
                <>
                  Il quinto slot di movimento è libero tra D / C / A (esempi:
                  1P-2D-1C-1A, 1P-1D-2C-1A, 1P-1D-1C-2A)
                </>
              ]}
            />
            <p className="font-medium text-brand-ink">Panchina</p>
            <RuleList
              items={[
                <>
                  Esattamente <strong>1 giocatore per ruolo</strong>: 1P + 1D +
                  1C + 1A
                </>,
                <>
                  L&apos;ordine in panchina non decide le sostituzioni: conta
                  solo il ruolo
                </>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>Sostituzioni automatiche</Subheading>
            <p>Al calcolo del punteggio squadra:</p>
            <RuleList
              items={[
                <>Se un titolare ha voto valido, conta il suo fantavoto.</>,
                <>
                  Se un titolare è <strong>SV</strong> (senza voto), il sistema
                  cerca in panchina un sostituto dello stesso ruolo con voto
                  valido.
                </>,
                <>
                  Al massimo <strong>1 sostituzione per ruolo</strong> (quindi
                  al massimo 4 a partita).
                </>,
                <>
                  Se non c&apos;è un sostituto valido dello stesso ruolo, quel
                  titolare resta in campo con <strong>0</strong> punti.
                </>
              ]}
            />
            <p>
              In sintesi: stesso ruolo, max 1 sub per ruolo, SV senza sub → 0.
            </p>
          </div>
        </Section>

        <Section id="fantavoto" title="3. Fantavoto e gol">
          <div className="space-y-3">
            <Subheading>Fantavoto del giocatore</Subheading>
            <p>
              Formula base (giocatore non SV):{" "}
              <strong>fantavoto = voto base + bonus − malus</strong>
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-fog/80 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Voce</th>
                    <th className="px-4 py-3 font-semibold">Punti</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  {[
                    ["Gol (non da rigore)", "+3", "Tutti"],
                    ["Assist", "+1", "Tutti"],
                    ["Rigore parato", "+3", "Tipicamente portieri"],
                    [
                      "Porta inviolata",
                      "+1",
                      "Solo portiere, se ha giocato e non ha subito gol"
                    ],
                    ["Gol subito", "−1", "Solo portieri"],
                    ["Rigore sbagliato", "−3", "Tutti"],
                    [
                      "Gol da rigore",
                      "+3",
                      "Tutti; si somma al gol di campo"
                    ],
                    ["Autogol", "−2", "Tutti"],
                    ["Ammonizione", "−0,5", "Tutti"],
                    ["Espulsione", "−1", "Tutti"]
                  ].map(([voce, punti, note]) => (
                    <tr key={voce} className="border-t border-slate-200">
                      <td className="px-4 py-3">{voce}</td>
                      <td className="px-4 py-3 font-semibold text-brand-ink">
                        {punti}
                      </td>
                      <td className="px-4 py-3">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <RuleList
              items={[
                <>
                  Voto con asterisco (es. 6*) o giocatore assente dai voti →{" "}
                  <strong>SV</strong> (nessun fantavoto valido).
                </>,
                <>
                  Il punteggio squadra è la somma dei fantavoti dei 5 che
                  contano dopo le sostituzioni automatiche.
                </>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>Da fantapunti a gol</Subheading>
            <p>
              Sotto 25 fantapunti → <strong>0 gol</strong>. Da 25 in poi:{" "}
              <strong>1 gol</strong>, poi <strong>+1 gol ogni 2 fantapunti</strong>{" "}
              (<code className="rounded bg-brand-fog px-1.5 py-0.5 text-xs">
                1 + parte intera di (punteggio − 25) / 2
              </code>
              ).
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-fog/80 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fantapunti</th>
                    <th className="px-4 py-3 font-semibold">Gol</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  {[
                    ["meno di 25", "0"],
                    ["25–26,9", "1"],
                    ["27–28,9", "2"],
                    ["29–30,9", "3"],
                    ["31–32,9", "4"]
                  ].map(([fp, gol]) => (
                    <tr key={fp} className="border-t border-slate-200">
                      <td className="px-4 py-3">{fp}</td>
                      <td className="px-4 py-3 font-semibold text-brand-ink">
                        {gol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>La stessa formula vale per lega e torneo.</p>
          </div>
        </Section>

        <Section id="formazione-mancante" title="4. Formazione mancante">
          <p>
            Alla chiusura delle formazioni, se una squadra non ha schierato:
          </p>
          <RuleList
            items={[
              <>
                Se esiste almeno una formazione inserita in precedenza (da
                proprietario o allenatore) nella stessa lega o nello stesso
                torneo → viene <strong>recuperata</strong> l&apos;ultima
                formazione valida. Non si recuperano formazioni generate
                automaticamente o inserite dall&apos;admin.
              </>,
              <>
                Se non esiste alcuna formazione precedente →{" "}
                <strong>forfait</strong>.
              </>
            ]}
          />

          <div className="space-y-3">
            <Subheading>Formazione recuperata</Subheading>
            <RuleList
              items={[
                <>La partita si gioca normalmente con quella formazione.</>,
                <>
                  <strong>−2 fantapunti</strong> sul totale squadra prima della
                  conversione in gol (il totale non scende sotto 0).
                </>,
                <>
                  In <strong>lega</strong>: anche <strong>−1 punto</strong> in
                  classifica (anche in caso di vittoria; la classifica può
                  andare sotto zero).
                </>,
                <>
                  In <strong>torneo</strong>: solo −2 fantapunti (non c&apos;è
                  classifica).
                </>,
                <>
                  Se un giocatore recuperato non è più in rosa, quello slot
                  vale SV (0).
                </>
              ]}
            />
            <p>
              Esempio: 29 fantapunti → 27 netti → 2 gol (non 3). Oppure 27 → 25
              → 1 gol (non 2).
            </p>
          </div>

          <div className="space-y-3">
            <Subheading>Forfait</Subheading>
            <p>
              Nessun calcolo fantapunti sulla squadra assente. Risultato a
              tavolino:
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-fog/80 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Situazione</th>
                    <th className="px-4 py-3 font-semibold">Risultato</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Solo la casa ha formazione</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">
                      3–0 per la casa
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Solo l&apos;ospite ha formazione</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">
                      0–3 (vince l&apos;ospite)
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Entrambe senza formazione</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">
                      0–0 (doppio forfait)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-medium text-brand-ink">Effetti in classifica (lega)</p>
            <RuleList
              items={[
                <>
                  Vittoria a tavolino: <strong>3 punti</strong> a chi ha
                  schierato (o ha formazione recuperata).
                </>,
                <>
                  Chi è in forfait: 0 dalla partita + <strong>−1</strong>{" "}
                  penale classifica.
                </>,
                <>
                  Doppio forfait 0–0: 0 punti partita a entrambe + −1 classifica
                  a entrambe.
                </>
              ]}
            />
          </div>
        </Section>

        <Section id="classifica" title="5. Classifica di lega">
          <p>Contano solo le partite pubblicate.</p>

          <div className="space-y-3">
            <Subheading>Punti partita</Subheading>
            <RuleList
              items={[
                <>Vittoria: <strong>3</strong> punti</>,
                <>Pareggio: <strong>1</strong> punto ciascuna</>,
                <>Sconfitta: <strong>0</strong> punti</>,
                <>Doppio forfait: 0 punti dalla partita</>,
                <>
                  Penali formazione (recuperata o forfait): −1 aggiuntivo; la
                  classifica può andare sotto zero
                </>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>In caso di parità</Subheading>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Punti di classifica</li>
              <li>Fantapunti totali</li>
              <li>Differenza reti</li>
              <li>Scelta dell&apos;admin</li>
            </ol>
          </div>
        </Section>

        <Section id="torneo" title="6. Torneo a eliminazione">
          <div className="space-y-3">
            <Subheading>Dimensioni</Subheading>
            <p>
              Il tabellone deve avere esattamente{" "}
              <strong>4, 8, 16, 32 o 64</strong> squadre. Fasi tipiche:
              Trentaduesimi → Sedicesimi → Ottavi → Quarti → Semifinali → Finale.
            </p>
          </div>

          <div className="space-y-3">
            <Subheading>Seeding</Subheading>
            <RuleList
              items={[
                <>
                  All&apos;iscrizione si salvano punti e fantapunti di lega come
                  riferimento di seeding.
                </>,
                <>
                  Accoppiamento alto vs basso (es. 1ª testa di serie vs ultima).
                </>,
                <>
                  Nella prima fase non sono ammessi scontri tra squadre della
                  stessa lega di provenienza.
                </>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>Andata / ritorno e finale</Subheading>
            <RuleList
              items={[
                <>
                  Tutte le fasi tranne la finale: serie di{" "}
                  <strong>andata e ritorno</strong>.
                </>,
                <>
                  <strong>Finale</strong>: solo andata (una partita).
                </>,
                <>
                  Formazioni e voti sono gestiti per fase e per leg (andata e
                  ritorno separati).
                </>
              ]}
            />
          </div>

          <div className="space-y-3">
            <Subheading>Chi avanza</Subheading>
            <p>Vince la serie chi prevale, in ordine, su:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Gol complessivi (andata + ritorno, o sola finale)</li>
              <li>Fantapunti complessivi</li>
              <li>Punti di lega allo snapshot di iscrizione</li>
              <li>Fantapunti di lega allo snapshot</li>
              <li>Se resta parità totale → scelta admin del vincitore</li>
            </ol>
          </div>

          <div className="space-y-3">
            <Subheading>Blocco giornata successiva</Subheading>
            <p>
              Non si aprono le formazioni della giornata successiva se la
              precedente non è completata nell&apos;ordine previsto, oppure se
              restano serie senza vincitore. In pratica: prima i vincitori di
              tutte le serie, poi si apre la giornata successiva.
            </p>
          </div>

          <div className="space-y-3">
            <Subheading>Formazione mancante in torneo</Subheading>
            <p>
              Valgono le stesse regole della lega (recupero ultima formazione
              del proprietario/allenatore, oppure forfait). In torneo si
              applicano solo i <strong>−2 fantapunti</strong> sulla formazione
              recuperata (niente −1 classifica).
            </p>
          </div>
        </Section>

        <Section id="coach" title="7. Allenatore (coach)">
          <RuleList
            items={[
              <>
                L&apos;owner può invitare un allenatore sulla propria squadra
                (link / token).
              </>,
              <>
                Dopo l&apos;accettazione, l&apos;allenatore può{" "}
                <strong>solo impostare la formazione</strong> (lega e torneo,
                quando aperte).
              </>,
              <>
                Non modifica la rosa, non gestisce la lega e non ha poteri
                admin/Mister.
              </>
            ]}
          />
        </Section>

        <Section id="riepilogo" title="8. Riepilogo rapido">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-fog/80 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold">Regola chiave</th>
                </tr>
              </thead>
              <tbody className="bg-white text-slate-600">
                {[
                  [
                    "Rosa",
                    "25 = 3P+8D+8C+6A; blocco owner a 25; admin può sempre"
                  ],
                  ["Esclusività", "1 giocatore → 1 sola squadra per lega"],
                  ["Formazione", "5+4; panchina 1 per ruolo"],
                  [
                    "Auto-sub",
                    "Stesso ruolo; max 1/ruolo; senza sub → 0"
                  ],
                  ["Gol", "<25 → 0; da 25: 1 + parte intera di (score−25)/2"],
                  [
                    "Formazione mancante",
                    "Recupero ultima formazione + −2 FP (−1 classifica in lega); altrimenti forfait 3–0 + −1"
                  ],
                  [
                    "Classifica",
                    "Punti (anche <0) → fantapunti → DR → scelta admin"
                  ],
                  [
                    "Torneo",
                    "4/8/16/32/64; A/R tranne finale; gol→FP→seed→admin"
                  ],
                  ["Allenatore", "Solo formazioni"]
                ].map(([area, regola]) => (
                  <tr key={area} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-brand-ink">
                      {area}
                    </td>
                    <td className="px-4 py-3">{regola}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 text-sm">
          <Link href="/" className="font-semibold text-brand-blue">
            ← Home
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/come-giocare"
              className="font-semibold text-brand-blue"
            >
              Come giocare
            </Link>
            <a
              href="#rosa"
              className="font-semibold text-slate-600 hover:text-brand-blue"
            >
              Torna all&apos;inizio
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
