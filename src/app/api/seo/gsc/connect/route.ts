import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildGscAuthUrl } from "@/lib/google-search-console/client";
import { createOAuthState } from "@/lib/google-search-console/oauth-state";

/** Startet den Google-Search-Console-OAuth-Flow für die SEO/GEO-Pipeline - nur AGENCY_ADMIN. */
export async function GET() {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();
  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  // Ohne gesetzte Zugangsdaten landete das vorher als nacktes "Missing
  // required parameter: client_id" direkt bei Google statt in unserer App -
  // verwirrend, weil es wie ein Google-Problem aussieht, obwohl nur
  // GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET in Vercel noch fehlen (siehe
  // .env.example). Früh abfangen und mit klarer Fehlermeldung zurückleiten.
  if (!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || !process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/seo?gscError=not_configured`);
  }

  const state = await createOAuthState();
  return NextResponse.redirect(buildGscAuthUrl(baseUrl, state));
}
