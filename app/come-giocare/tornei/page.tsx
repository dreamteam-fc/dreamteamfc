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
  title: "Come giocare — Tornei | Dream Team FC",
  description:
    "Come sbloccare l'accesso al torneo, vedere il tabellone e schierare le formazioni."
};

export default function ComeGiocareTorneiPage() {
  return (
    <GuideShell
      currentHref="/come-giocare/tornei"
      title="Tornei"
      description="Tornei cross-lega a eliminazione: sblocco accesso, tabellone e formazioni di fase."
    >
      <GuideSection title="1. Dove trovi i tornei">
        <GuideList
          items={[
            <>
              Lista:{" "}
              <Link
                href="/tournaments"
                className="font-semibold text-brand-blue"
              >
                /tournaments
              </Link>{" "}
              (anche da home, /me e header area utente)
            </>,
            <>
              Tabellone:{" "}
              <code className="text-brand-ink">/tournaments/[id]</code>
            </>,
            <>
              Su{" "}
              <Link href="/me" className="font-semibold text-brand-blue">
                /me
              </Link>
              , se hai partite da schierare, compare il blocco{" "}
              <strong>Partite torneo da schierare</strong>
            </>
          ]}
        />
        <p>
          L&apos;iscrizione al tabellone la gestisce l&apos;organizzatore: tu
          vedi le tue squadre selezionate e, se serve, sblocchi l&apos;accesso.
        </p>
      </GuideSection>

      <GuideSection title="2. Sbloccare l'accesso (solo proprietario)">
        <GuideSteps
          items={[
            <>
              Da /me, sulla partita torneo, clicca <em>Sblocca accesso</em>{" "}
              (oppure apri{" "}
              <code className="text-brand-ink">
                /tournaments/[id]/activate
              </code>
              ).
            </>,
            <>
              Inserisci la <strong>password del torneo</strong> comunicata
              dall&apos;organizzatore.
            </>,
            <>
              Dopo lo sblocco puoi schierare quando le formazioni della fase
              sono aperte.
            </>
          ]}
        />
        <GuideList
          items={[
            <>
              Solo il <strong>proprietario</strong> sblocca: l&apos;allenatore
              vede “In attesa sblocco proprietario” finché non è fatto.
            </>,
            <>
              Se nessuna tua squadra è selezionata, la pagina di attivazione lo
              indica chiaramente.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="3. Schierare in torneo">
        <GuideSteps
          items={[
            <>
              Controlla /me → <em>Partite torneo da schierare</em>, oppure il
              tabellone.
            </>,
            <>
              Clicca <em>Schiera formazione</em> /{" "}
              <em>Modifica formazione</em>.
            </>,
            <>
              Pagina:{" "}
              <code className="text-brand-ink">
                /me/teams/.../tournaments/fixtures/.../lineup
              </code>
              .
            </>,
            <>
              Stesse regole 5+4 della lega; salva con{" "}
              <em>Salva formazione torneo</em>.
            </>
          ]}
        />
        <GuideSubheading>Quando è modificabile</GuideSubheading>
        <GuideList
          items={[
            <>Accesso torneo <strong>sbloccato</strong></>,
            <>
              Formazioni della giornata/fase <strong>aperte</strong> (non
              “chiuse” / “non ancora aperte”)
            </>,
            <>
              Partita in stato <strong>READY</strong>
            </>,
            <>Rosa della squadra valida (altrimenti ti manda a completarla)</>
          ]}
        />
        <p>
          Andata e ritorno sono partite separate: schieri per ciascuna gamba
          quando aperta. La finale è di solito una sola partita.
        </p>
      </GuideSection>

      <GuideSection title="4. Se dimentichi in torneo">
        <GuideList
          items={[
            <>
              Alla chiusura, se esiste un&apos;ultima formazione tua o
              dell&apos;allenatore <strong>in quel torneo</strong>, viene
              recuperata con −2 fantapunti (niente −1 classifica: in torneo non
              c&apos;è classifica di lega).
            </>,
            <>
              Se non hai mai schierato in quel torneo → forfait.
            </>,
            <>
              Il recupero usa solo formazioni “vere” (proprietario/allenatore),
              non quelle generate dall&apos;admin.
            </>
          ]}
        />
        <p>
          Tabellone, seeding e chi avanza:{" "}
          <Link
            href="/regolamento#torneo"
            className="font-semibold text-brand-blue"
          >
            Regolamento § Torneo
          </Link>
          .
        </p>
      </GuideSection>
    </GuideShell>
  );
}
