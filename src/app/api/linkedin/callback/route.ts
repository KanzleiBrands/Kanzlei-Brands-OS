import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeLinkedInCode } from "@/lib/linkedin/client";
import { verifyAndClearLinkedInOAuthState } from "@/lib/linkedin/oauth-state";
import { storeLinkedInPendingConnection } from "@/lib/linkedin/pending-connection";

export async function GET(request: NextRequest) {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const verified = await verifyAndClearLinkedInOAuthState(state);
  if (oauthError || !verified || !code) {
    const target = verified
      ? `${baseUrl}/dashboard/clients/${verified.organizationId}?tab=content&error=linkedin_connect_failed`
      : `${baseUrl}/dashboard/clients`;
    return NextResponse.redirect(target);
  }

  try {
    const token = await exchangeLinkedInCode(baseUrl, code);
    await storeLinkedInPendingConnection(verified.organizationId, token.access_token, token.expires_in);
    return NextResponse.redirect(`${baseUrl}/dashboard/clients/${verified.organizationId}/connect-linkedin`);
  } catch (error) {
    console.error("LinkedIn OAuth callback failed", error);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/clients/${verified.organizationId}?tab=content&error=linkedin_connect_failed`,
    );
  }
}
