import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEasybillCashIn } from "@/lib/cashflow/easybill-sync";

/** Polled by Vercel Cron (siehe vercel.json) - zieht EasyBill-Cash-In-Daten in einem festen Intervall statt bei jedem Tab-/Monatswechsel live. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agency = await prisma.organization.findFirst({ where: { type: "AGENCY" }, select: { id: true } });
  if (!agency) return NextResponse.json({ ok: false, error: "Keine AGENCY-Organisation gefunden." });

  const result = await syncEasybillCashIn(agency.id);
  return NextResponse.json(result);
}
