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
  title: "Come giocare — Formazioni | Dream Team FC",
  description:
    "Come e quando schierare la formazione di giornata, cosa fare se dimentichi, owner vs allenatore."
};

export default function ComeGiocareFormazioniPage() {
  return (
    <GuideShell
      currentHref="/come-giocare/formazioni"
      title="Formazioni"
      description="Quando puoi schierare, come salvare o eliminare la XI, e cosa succede se dimentichi."
    >
      <GuideSection title="1. Quando puoi schierare">
        <p>
          Puoi salvare o modificare la formazione{" "}
          <strong>solo a formazioni aperte</strong>.
        </p>
        <GuideList
          items={[
            <>
              In lega lo stato giornata deve essere{" "}
              <strong>Formazioni aperte</strong> (
              <code className="text-brand-ink">LINEUPS_OPEN</code>).
            </>,
            <>
              Se vedi <strong>Formazioni chiuse</strong>, non puoi più salvare
              né eliminare.
            </>,
            <>
              L&apos;apertura/chiusura la fa l&apos;organizzatore: tu controlli
              /me, il dettaglio squadra o il calendario lega.
            </>,
            <>
              Spesso compare anche una <strong>deadline</strong> sulla prossima
              giornata: è un riferimento, ma conta lo stato “aperte / chiuse”.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="2. Percorso click per click (lega)">
        <GuideSteps
          items={[
            <>
              Vai su{" "}
              <Link href="/me" className="font-semibold text-brand-blue">
                /me
              </Link>
              .
            </>,
            <>
              Nella tua squadra, sotto <em>Giornate aperte</em>, clicca la
              giornata (oppure apri la squadra → <em>Schiera formazione</em> /
              <em>Modifica formazione</em>).
            </>,
            <>
              Arrivi a{" "}
              <code className="text-brand-ink">
                /me/teams/.../matchdays/.../lineup
              </code>
              .
            </>,
            <>
              Per ogni giocatore scegli <strong>Titolare</strong>,{" "}
              <strong>Panchina</strong> o nessuno.
            </>,
            <>
              Premi <em>Salva formazione</em>.
            </>
          ]}
        />
        <GuideSubheading>Cosa schierare</GuideSubheading>
        <GuideList
          items={[
            <>
              <strong>5 titolari:</strong> 1 portiere + almeno 1D, 1C, 1A + 1
              libero tra D/C/A
            </>,
            <>
              <strong>4 panchina:</strong> esattamente 1P + 1D + 1C + 1A
            </>,
            <>9 giocatori unici, senza doppioni</>
          ]}
        />
        <p>
          Dettaglio moduli e sostituzioni automatiche:{" "}
          <Link
            href="/regolamento#formazione"
            className="font-semibold text-brand-blue"
          >
            Regolamento § Formazione
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection title="3. Eliminare e riscrivere">
        <GuideList
          items={[
            <>
              Nella stessa pagina, sezione <em>Formazione attuale</em>, usa{" "}
              <em>Elimina formazione</em>.
            </>,
            <>
              Funziona <strong>solo a formazioni aperte</strong>.
            </>,
            <>Dopo l&apos;eliminazione puoi salvare una nuova XI.</>
          ]}
        />
      </GuideSection>

      <GuideSection title="4. Proprietario vs allenatore">
        <GuideList
          items={[
            <>
              Se salva il <strong>proprietario</strong>, in area operatori la
              formazione risulta inserita dall&apos;utente.
            </>,
            <>
              Se salva l&apos;<strong>allenatore</strong>, compare il badge{" "}
              <strong>MISTER</strong>.
            </>,
            <>
              Entrambe contano come formazione “vera” anche per il recupero
              automatico alla chiusura.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="5. Se dimentichi di schierare">
        <p>
          Alla <strong>chiusura formazioni</strong> (la fa
          l&apos;organizzatore):
        </p>
        <GuideList
          items={[
            <>
              Se in passato hai già schierato in <strong>quella lega</strong>{" "}
              (tu o l&apos;allenatore) → viene <strong>recuperata</strong>{" "}
              l&apos;ultima formazione valida, con penali leggere (−2 fantapunti
              e −1 in classifica in lega).
            </>,
            <>
              Se non hai mai schierato in quella lega →{" "}
              <strong>forfait</strong> (es. 3–0) + penale classifica.
            </>,
            <>
              Non vengono recuperate formazioni generate automaticamente o
              inserite dall&apos;admin.
            </>
          ]}
        />
        <p>
          Il recupero è una rete di sicurezza: conviene schierare ogni
          giornata. Regole complete:{" "}
          <Link
            href="/regolamento#formazione-mancante"
            className="font-semibold text-brand-blue"
          >
            Regolamento § Formazione mancante
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection title="6. Dopo la pubblicazione">
        <GuideList
          items={[
            <>
              Controlla il risultato della giornata sulla pagina pubblica della
              lega.
            </>,
            <>
              Aggiorna la{" "}
              <Link
                href="/come-giocare/lega"
                className="font-semibold text-brand-blue"
              >
                classifica
              </Link>{" "}
              da /leagues/.../standings.
            </>,
            <>
              Se un titolare è SV, il sistema può sostituirlo con il panchinaro
              dello stesso ruolo (max 1 sub per ruolo).
            </>
          ]}
        />
      </GuideSection>
    </GuideShell>
  );
}
