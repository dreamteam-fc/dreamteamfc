import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BrandHeader } from "@/components/brand/brand-header";
import { getPublicLeagueLayoutData } from "@/lib/server/public/read-public-league-data";

export const dynamic = "force-dynamic";

type PublicLeagueLayoutProps = {
  children: ReactNode;
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function PublicLeagueLayout({
  children,
  params
}: PublicLeagueLayoutProps) {
  const { leagueId } = await params;
  const league = await getPublicLeagueLayoutData(leagueId);

  if (!league) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BrandHeader
          title={league.name}
          description="Area partecipanti in sola lettura con classifica, giornate pubblicate, risultati e scontri diretti."
          actions={
            <>
              <Link
                href={`/leagues/${league.id}`}
                className="rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-void transition hover:bg-[#ffd24a]"
              >
                Home lega
              </Link>
              <Link
                href={`/leagues/${league.id}/schedule`}
                className="btn-brand-secondary"
              >
                Calendario
              </Link>
              <Link
                href={`/leagues/${league.id}/standings`}
                className="btn-brand-secondary"
              >
                Classifica
              </Link>
            </>
          }
        />

        {children}
      </div>
    </main>
  );
}
