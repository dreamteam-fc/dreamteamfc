import type { Metadata } from "next";
import Link from "next/link";

import {
  GuideList,
  GuideSection,
  GuideShell,
  GuideSteps,
  GuideSubheading,
  guideSections
} from "@/components/guide/guide-shell";

export const metadata: Metadata = {
  title: "Come giocare | Dream Team FC",
  description:
    "Guida pratica Dream Team FC: iscrizione, rosa, formazioni, tornei e allenatore."
};

export default function ComeGiocarePage() {
  return (
    <GuideShell
      currentHref="/come-giocare"
      title="Come giocare"
      description="Guida pratica passo passo: dalla registrazione alla formazione, fino a classifica e tornei. Le regole ufficiali restano nel Regolamento."
    >
      <GuideSection title="A chi serve questa guida">
        <p>
          Qui trovi <strong>cosa cliccare</strong> nell&apos;app. Per punteggi,
          forfait e dettagli di regolamento vai a{" "}
          <Link href="/regolamento" className="font-semibold text-brand-blue">
            Regolamento
          </Link>
          .
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-fog/80 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Ruolo</th>
                <th className="px-4 py-3 font-semibold">Cosa puoi fare</th>
              </tr>
            </thead>
            <tbody className="bg-white text-slate-600">
              <tr className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-brand-ink">
                  Proprietario (owner)
                </td>
                <td className="px-4 py-3">
                  Entra in lega, crea/gestisci squadra, rosa (fino a 25),
                  formazioni, logo, invita allenatore, sblocca torneo
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-brand-ink">
                  Allenatore (coach)
                </td>
                <td className="px-4 py-3">
                  Solo formazioni della squadra a cui sei stato invitato (lega e
                  torneo, quando aperte)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Non esiste un “admin di lega”: in lega sei proprietario della tua
          squadra oppure allenatore con soli poteri di formazione.
        </p>
      </GuideSection>

      <GuideSection title="Percorso rapido">
        <GuideSteps
          items={[
            <>
              <strong>Registrati</strong> o <strong>Accedi</strong> dalla home,
              poi apri{" "}
              <Link href="/me" className="font-semibold text-brand-blue">
                /me
              </Link>{" "}
              (La mia area).
            </>,
            <>
              Da{" "}
              <Link href="/leagues" className="font-semibold text-brand-blue">
                Leghe disponibili
              </Link>{" "}
              entra in una lega con la password che ti dà l&apos;organizzatore e
              crea la squadra.
            </>,
            <>
              Completa la <strong>rosa da 25</strong> (3P, 8D, 8C, 6A) da{" "}
              <em>Gestisci rosa</em>.
            </>,
            <>
              Quando le formazioni sono <strong>aperte</strong>, schiera 5
              titolari + 4 panchina e premi <em>Salva formazione</em>.
            </>,
            <>
              Dopo la pubblicazione della giornata, controlla risultato e{" "}
              <strong>classifica</strong> dalle pagine della lega.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="Sezioni della guida">
        <div className="grid gap-3">
          {guideSections
            .filter((section) => section.href !== "/come-giocare")
            .map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="rounded-2xl border border-slate-200 bg-brand-fog/60 px-4 py-4 transition hover:border-brand-blue/40"
              >
                <p className="font-semibold text-brand-ink">{section.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {section.description}
                </p>
              </Link>
            ))}
        </div>
      </GuideSection>

      <GuideSection title="Checklist settimanale">
        <GuideList
          items={[
            <>
              Apri <strong>/me</strong> e controlla le giornate aperte
            </>,
            <>
              Se vedi “Formazioni aperte”, schiera (o fai schierare
              l&apos;allenatore)
            </>,
            <>
              Verifica di aver salvato: in pagina compare la formazione attuale
            </>,
            <>
              Dopo la pubblicazione: controlla risultato e classifica sulla
              lega
            </>,
            <>
              Se sei in torneo: controlla anche le partite da schierare su /me
            </>
          ]}
        />
        <GuideSubheading>Problemi tipici</GuideSubheading>
        <GuideList
          items={[
            <>
              <strong>Non salvo la formazione:</strong> formazioni chiuse, rosa
              incompleta o giocatore non disponibile — leggi il messaggio in
              pagina.
            </>,
            <>
              <strong>Rosa bloccata a 25:</strong> normale; per sostituzioni
              chiedi all&apos;organizzatore.
            </>,
            <>
              <strong>“Giocatore già in un&apos;altra rosa”:</strong> nella
              stessa lega è esclusivo.
            </>,
            <>
              <strong>Non vedo i risultati:</strong> la giornata forse non è
              ancora pubblicata.
            </>
          ]}
        />
      </GuideSection>
    </GuideShell>
  );
}
