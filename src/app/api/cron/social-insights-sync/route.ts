import { NextResponse } from "next/server";
import { syncSocialInsights } from "@/lib/social/insights-sync";

/** Polled by Vercel Cron (see vercel.json) - refreshes performance metrics for published posts. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncSocialInsights();
  return NextResponse.json(result);
}
