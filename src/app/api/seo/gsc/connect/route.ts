import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildGscAuthUrl } from "@/lib/google-search-console/client";
import { createOAuthState } from "@/lib/google-search-console/oauth-state";

/** Startet den Google-Search-Console-OAuth-Flow für die SEO/GEO-Pipeline - nur AGENCY_ADMIN. */
export async function GET() {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const baseUrl = await getBaseUrl();
  const state = await createOAuthState();
  return NextResponse.redirect(buildGscAuthUrl(baseUrl, state));
}
