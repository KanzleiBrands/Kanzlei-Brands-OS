import { NextResponse } from "next/server";
import { syncFirefliesTranscripts } from "@/lib/actions/fireflies";

/** Polled by Vercel Cron (see vercel.json) - zieht neue Fireflies-Call-Transkripte, sofern der Sync aktiviert ist. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncFirefliesTranscripts();
  return NextResponse.json(result);
}
