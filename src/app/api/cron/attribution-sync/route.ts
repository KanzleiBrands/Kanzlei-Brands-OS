import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCloseAttribution } from "@/lib/attribution/close-sync";

/** Polled by Vercel Cron (see vercel.json) - hält Candidate-Journeys/Kampagnen-Zuordnung aus Close.io automatisch aktuell, kein manueller Button nötig. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agency = await prisma.organization.findFirst({ where: { type: "AGENCY" }, select: { id: true } });
  if (!agency) return NextResponse.json({ ok: false, error: "Keine AGENCY-Organisation gefunden." });

  const result = await syncCloseAttribution(agency.id);
  return NextResponse.json(result);
}
