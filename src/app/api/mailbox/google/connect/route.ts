import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildGoogleAuthUrl } from "@/lib/mailbox/google";
import { createOAuthState } from "@/lib/mailbox/oauth-state";

export async function GET() {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const state = await createOAuthState();
  return NextResponse.redirect(buildGoogleAuthUrl(baseUrl, state));
}
