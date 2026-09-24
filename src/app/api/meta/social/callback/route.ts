import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeMetaSocialCode, exchangeForLongLivedUserToken } from "@/lib/meta/graph";
import { verifyAndClearMetaSocialOAuthState } from "@/lib/meta/social-oauth-state";
import { storeSocialPendingConnection } from "@/lib/meta/social-pending-connection";

export async function GET(request: NextRequest) {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const verified = await verifyAndClearMetaSocialOAuthState(state);
  if (oauthError || !verified || !code) {
    const target = verified
      ? `${baseUrl}/dashboard/clients/${verified.organizationId}?tab=content&error=meta_connect_failed`
      : `${baseUrl}/dashboard/clients`;
    return NextResponse.redirect(target);
  }

  try {
    const shortLived = await exchangeMetaSocialCode(baseUrl, code);
    const longLived = await exchangeForLongLivedUserToken(shortLived.access_token);
    await storeSocialPendingConnection(verified.organizationId, longLived.access_token);
    return NextResponse.redirect(`${baseUrl}/dashboard/clients/${verified.organizationId}/connect-meta-social`);
  } catch (error) {
    console.error("Meta social OAuth callback failed", error);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/clients/${verified.organizationId}?tab=content&error=meta_connect_failed`,
    );
  }
}
