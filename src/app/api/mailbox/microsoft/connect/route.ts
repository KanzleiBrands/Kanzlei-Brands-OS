import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildMicrosoftAuthUrl } from "@/lib/mailbox/microsoft";
import { createOAuthState } from "@/lib/mailbox/oauth-state";

export async function GET() {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const state = await createOAuthState();
  return NextResponse.redirect(buildMicrosoftAuthUrl(baseUrl, state));
}
