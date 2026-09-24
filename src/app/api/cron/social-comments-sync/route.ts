import { NextResponse } from "next/server";
import { syncAllSocialComments } from "@/lib/social/comments-sync";

/** Polled by Vercel Cron (see vercel.json) - backfills comments on published posts, on top of the real-time webhook. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllSocialComments();
  return NextResponse.json(result);
}
