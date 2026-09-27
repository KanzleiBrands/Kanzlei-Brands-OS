import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAdSpend } from "@/lib/attribution/spend-sync";

/** Polled by Vercel Cron (see vercel.json) - zieht Werbekosten automatisch aus Meta/Google/LinkedIn, sobald die jeweiligen Ads-API-Zugänge konfiguriert sind. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agency = await prisma.organization.findFirst({ where: { type: "AGENCY" }, select: { id: true } });
  if (!agency) return NextResponse.json({ ok: false, error: "Keine AGENCY-Organisation gefunden." });

  const result = await syncAdSpend(agency.id);
  return NextResponse.json({ ok: true, results: result });
}
