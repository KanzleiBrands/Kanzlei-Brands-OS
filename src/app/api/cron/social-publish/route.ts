import { NextResponse } from "next/server";
import { publishDueSocialPosts } from "@/lib/social/publish";

/** Polled by Vercel Cron (see vercel.json) - publishes every due SCHEDULED SocialPost. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await publishDueSocialPosts();
  return NextResponse.json(result);
}
