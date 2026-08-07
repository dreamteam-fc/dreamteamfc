import type { Metadata } from "next";
import Link from "next/link";

import {
  GuideList,
  GuideSection,
  GuideShell,
  GuideSteps,
  GuideSubheading
} from "@/components/guide/guide-shell";

export const metadata: Metadata = {
  title: "Come giocare — Lega e squadra | Dream Team FC",
  description:
    "Come iscriversi a una lega, creare la squadra, gestire rosa, logo e classifica."
};

export default function ComeGiocareLegaPage() {
  return (
    <GuideShell
      currentHref="/come-giocare/lega"
      title="Lega e squadra"
      description="Iscriviti a una lega, crea la squadra fantasy, completa la rosa e segui calendario e classifica."
    >
      <GuideSection title="1. Area personale (/me)">
        <p>
          Dopo il login, la home operativa è{" "}
          <Link href="/me" className="font-semibold text-brand-blue">
            /me
          </Link>
          .
        </p>
        <GuideList
          items={[
            <>
              Pulsanti in alto nel profilo:{" "}
              <em>Regolamento</em>, <em>Come giocare</em>, <em>Tornei</em>,{" "}
              <em>Leghe disponibili</em>
            </>,
            <>
              Sezione <strong>Le mie squadre</strong>: apri la squadra o vai
              direttamente a una giornata aperta
            </>,
            <>
              Sezione <strong>Squadre come allenatore</strong>: squadre che
              alleni (solo formazioni)
            </>,
            <>
              Sezione <strong>Le mie leghe</strong>: apri la lega pubblica o la
              tua squadra
            </>,
            <>
              Eventuale blocco <strong>Partite torneo da schierare</strong>
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="2. Entrare in una lega">
        <GuideSteps
          items={[
            <>
              Apri{" "}
              <Link href="/leagues" className="font-semibold text-brand-blue">
                /leagues
              </Link>{" "}
              (anche da home o da /me).
            </>,
            <>Scegli la lega e apri la scheda pubblica.</>,
            <>
              Clicca per <strong>entrare / iscriverti</strong> (pagina{" "}
              <code className="text-brand-ink">/leagues/[lega]/join</code>).
            </>,
            <>
              Inserisci la <strong>password di iscrizione</strong> che ti
              comunica l&apos;organizzatore.
            </>,
            <>
              Crea la <strong>squadra fantasy</strong> (nome e dati richiesti dal
              form).
            </>
          ]}
        />
        <GuideList
          items={[
            <>Ogni lega ha un numero massimo di squadre (tipicamente 10).</>,
            <>Una sola squadra per utente per lega.</>,
            <>
              Se il calendario è già generato, le iscrizioni possono risultare
              chiuse.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="3. Dettaglio squadra">
        <p>
          Percorso: da /me → <em>Apri squadra</em> →{" "}
          <code className="text-brand-ink">/me/teams/[tuaSquadra]</code>.
        </p>
        <GuideSubheading>Cosa trovi (proprietario)</GuideSubheading>
        <GuideList
          items={[
            <>
              <em>Gestisci rosa</em> → pagina rosa
            </>,
            <>
              <em>Apri lega</em> e <em>Classifica pubblica</em>
            </>,
            <>Caricamento / aggiornamento <strong>logo</strong> squadra</>,
            <>
              <strong>Stato rosa</strong> (incompleta / valida) e conteggi per
              ruolo
            </>,
            <>
              <strong>Prossima giornata</strong> e pulsante{" "}
              <em>Schiera formazione</em> se le formazioni sono aperte
            </>,
            <>
              <strong>Calendario</strong> di tutte le giornate, con modifica
              formazione quando aperta
            </>,
            <>
              Elenco rosa attuale e sezione <strong>Allenatore</strong> (inviti)
            </>,
            <>
              Eventuale <em>Abbandona lega</em> (solo se non hai ancora
              partecipato a giornate e il calendario non è generato)
            </>
          ]}
        />
        <GuideSubheading>Se sei allenatore</GuideSubheading>
        <p>
          Vedi un avviso “Accesso allenatore”: puoi aprire la squadra e
          schierare, ma <strong>non</strong> gestisci rosa, logo, inviti né
          abbandono lega. Dettagli in{" "}
          <Link
            href="/come-giocare/allenatore"
            className="font-semibold text-brand-blue"
          >
            Allenatore
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection title="4. Rosa (25 giocatori)">
        <p>
          Percorso: dettaglio squadra → <em>Gestisci rosa</em> →{" "}
          <code className="text-brand-ink">/me/teams/[tuaSquadra]/roster</code>
          .
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
              {[
                ["Portieri (P)", "3"],
                ["Difensori (D)", "8"],
                ["Centrocampisti (C)", "8"],
                ["Attaccanti (A)", "6"],
                ["Totale", "25"]
              ].map(([ruolo, qty]) => (
                <tr key={ruolo} className="border-t border-slate-200">
                  <td className="px-4 py-3">{ruolo}</td>
                  <td className="px-4 py-3 font-semibold text-brand-ink">
                    {qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <GuideList
          items={[
            <>
              Puoi aggiungere/rimuovere giocatori{" "}
              <strong>solo finché la rosa ha meno di 25</strong>.
            </>,
            <>
              A 25 la rosa è <strong>congelata</strong> per te: per cambiare
              serve l&apos;organizzatore.
            </>,
            <>
              Nella stessa lega un giocatore reale sta in{" "}
              <strong>una sola</strong> rosa.
            </>,
            <>
              Completa la rosa <strong>prima</strong> di schierare: senza rosa
              valida non salvi la formazione.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="5. Classifica, calendario e risultati">
        <p>
          Pagine pubbliche della lega (anche senza login, se la lega è
          pubblica):
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-fog/80 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Cosa</th>
                <th className="px-4 py-3 font-semibold">Dove</th>
              </tr>
            </thead>
            <tbody className="bg-white text-slate-600">
              {[
                ["Info lega", "/leagues/[lega]"],
                ["Calendario", "/leagues/[lega]/schedule"],
                ["Classifica", "/leagues/[lega]/standings"],
                ["Giornata / risultati", "/leagues/[lega]/matchdays/[giornata]"]
              ].map(([cosa, dove]) => (
                <tr key={cosa} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-brand-ink">
                    {cosa}
                  </td>
                  <td className="px-4 py-3">{dove}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Risultati e punti in classifica compaiono dopo che
          l&apos;organizzatore <strong>pubblica</strong> la giornata. Finché non
          è pubblicata, puoi vedere calendario e stati (es. “Formazioni
          aperte” / “Formazioni chiuse”) ma non il risultato definitivo.
        </p>
        <p>
          Per le regole su punti, forfait e scontri a parità:{" "}
          <Link href="/regolamento" className="font-semibold text-brand-blue">
            Regolamento
          </Link>
          .
        </p>
      </GuideSection>
    </GuideShell>
  );
}
