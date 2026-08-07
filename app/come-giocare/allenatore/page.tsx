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
  title: "Come giocare — Allenatore | Dream Team FC",
  description:
    "Come invitare un allenatore, accettare l'invito e schierare con il badge MISTER."
};

export default function ComeGiocareAllenatorePage() {
  return (
    <GuideShell
      currentHref="/come-giocare/allenatore"
      title="Allenatore"
      description="Delega le formazioni a un altro account: invito, accettazione e limiti del ruolo coach."
    >
      <GuideSection title="1. Cosa può fare l'allenatore">
        <GuideList
          items={[
            <>
              Impostare (e modificare) la <strong>formazione</strong> in lega e
              in torneo, quando le formazioni sono aperte
            </>,
            <>
              Vedere la squadra e le giornate aperte da{" "}
              <Link href="/me" className="font-semibold text-brand-blue">
                /me
              </Link>{" "}
              (sezione <em>Squadre come allenatore</em>)
            </>
          ]}
        />
        <GuideSubheading>Cosa non può fare</GuideSubheading>
        <GuideList
          items={[
            <>Modificare la rosa</>,
            <>Caricare/cambiare il logo</>,
            <>Invitare altri allenatori</>,
            <>Abbandonare la lega</>,
            <>Sbloccare l&apos;accesso torneo (serve il proprietario)</>
          ]}
        />
      </GuideSection>

      <GuideSection title="2. Se sei proprietario: invita">
        <GuideSteps
          items={[
            <>
              Apri la tua squadra:{" "}
              <code className="text-brand-ink">/me/teams/[tuaSquadra]</code>.
            </>,
            <>
              Nella sezione <strong>Allenatore</strong>, inserisci l&apos;email
              dell&apos;allenatore.
            </>,
            <>
              Premi <em>Crea invito</em>.
            </>,
            <>
              Copia il <strong>link assoluto</strong> che compare (non parte
              nessuna email automatica) e invialo tu.
            </>,
            <>
              Il link scade in <strong>14 giorni</strong>. Se lo perdi, sugli
              inviti pendenti usa <em>Nuovo link</em>.
            </>
          ]}
        />
        <GuideList
          items={[
            <>
              <em>Annulla invito</em> revoca un invito ancora pendente.
            </>,
            <>
              <em>Rimuovi</em> toglie un allenatore già attivo.
            </>
          ]}
        />
      </GuideSection>

      <GuideSection title="3. Se sei allenatore: accetta">
        <GuideSteps
          items={[
            <>
              Accedi con <strong>la stessa email</strong> dell&apos;invito.
            </>,
            <>
              Apri il link:{" "}
              <code className="text-brand-ink">
                /me/coach-invites/[token]
              </code>
              .
            </>,
            <>
              Controlla squadra, lega e email, poi premi{" "}
              <em>Accetta invito allenatore</em>.
            </>,
            <>
              Da /me vedi la squadra in <em>Squadre come allenatore</em> →{" "}
              <em>Apri squadra</em> o vai alle giornate aperte.
            </>
          ]}
        />
        <p>
          Se l&apos;invito è scaduto o già usato, la pagina lo indica e non
          puoi accettarlo di nuovo: chiedi al proprietario un nuovo link.
        </p>
      </GuideSection>

      <GuideSection title="4. Schierare come allenatore">
        <GuideList
          items={[
            <>
              Usi le <strong>stesse pagine formazione</strong> del
              proprietario (lega e torneo).
            </>,
            <>
              Quando salvi, in area operatori la formazione compare con badge{" "}
              <strong>MISTER</strong> (non “inserita” dall&apos;owner).
            </>,
            <>
              Alla chiusura giornate, anche le formazioni allenatore contano
              per il <strong>recupero automatico</strong> (insieme a quelle del
              proprietario).
            </>,
            <>
              In torneo, se l&apos;accesso non è sbloccato, aspetti il
              proprietario; poi puoi schierare normalmente.
            </>
          ]}
        />
        <p>
          Per struttura 5+4 e stati aperti/chiusi:{" "}
          <Link
            href="/come-giocare/formazioni"
            className="font-semibold text-brand-blue"
          >
            Formazioni
          </Link>
          . Regole ufficiali:{" "}
          <Link
            href="/regolamento#coach"
            className="font-semibold text-brand-blue"
          >
            Regolamento § Allenatore
          </Link>
          .
        </p>
      </GuideSection>
    </GuideShell>
  );
}
