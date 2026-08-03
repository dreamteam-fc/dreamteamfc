import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = () =>
  NextResponse.json(
    {
      status: "ok",
      service: "fantacalcetto",
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );

/** Liveness only — no DB. Railway healthcheck must get 200 quickly once Next is up. */
export async function GET() {
  return body();
}

/** Some probes use HEAD; keep it cheap and successful. */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
