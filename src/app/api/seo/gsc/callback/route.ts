import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeGscCode } from "@/lib/google-search-console/client";
import { verifyAndClearOAuthState } from "@/lib/google-search-console/oauth-state";
import { encryptToken } from "@/lib/auth-encryption";

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";

/**
 * Speichert die Tokens, aber noch OHNE Property (siteUrl bleibt null) - welche
 * Property gemeint ist, lässt sich erst nach dem Login per sites.list abfragen,
 * siehe getGscSiteOptions/selectGscSite in src/lib/actions/seo.ts. Die
 * Konfiguration zeigt dann die Property-Auswahl an.
 */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const stateOk = await verifyAndClearOAuthState(state);
  if (!stateOk || !code || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.redirect(`${baseUrl}${SEO_TAB_PATH}?gscError=invalid_state`);
  }

  try {
    const tokens = await exchangeGscCode(baseUrl, code);
    if (!tokens.refresh_token) {
      throw new Error("Kein Refresh-Token erhalten - Zugriff im Google-Account widerrufen und erneut versuchen.");
    }

    await prisma.googleSearchConsoleConnection.upsert({
      where: { id: "singleton" },
      update: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        siteUrl: null,
        lastSyncError: null,
      },
      create: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(`${baseUrl}${SEO_TAB_PATH}?gscConnected=1`);
  } catch (error) {
    console.error("Google Search Console connect failed", error);
    return NextResponse.redirect(`${baseUrl}${SEO_TAB_PATH}?gscError=connect_failed`);
  }
}
