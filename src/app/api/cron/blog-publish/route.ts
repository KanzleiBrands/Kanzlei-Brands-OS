import { NextResponse } from "next/server";
import { publishDueBlogPosts } from "@/lib/blog/publish";

/** Polled by Vercel Cron (see vercel.json) - veröffentlicht fällige, bereits freigegebene Blogartikel (nur Status-/Zeitstempel-Wechsel, siehe publish.ts). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await publishDueBlogPosts();
  return NextResponse.json(result);
}
