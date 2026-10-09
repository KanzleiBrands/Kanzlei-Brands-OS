import { NextResponse } from "next/server";
import { syncCloseCallTranscripts } from "@/lib/actions/close-calls";

/** Polled by Vercel Cron (see vercel.json) - zieht neue Close.io-Call-Transkripte (Cold Calls, Quali-Calls etc.), sofern der Sync aktiviert ist. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncCloseCallTranscripts();
  return NextResponse.json(result);
}
