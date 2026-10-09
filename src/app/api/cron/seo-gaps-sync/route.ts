import { NextResponse } from "next/server";
import { syncSeoContentGaps } from "@/lib/actions/seo-gaps";

/** Polled by Vercel Cron (see vercel.json) - analysiert die eigenen Google-Search-Console-Daten auf Content-Lücken, sofern eine Property verbunden ist. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncSeoContentGaps();
  return NextResponse.json(result);
}
