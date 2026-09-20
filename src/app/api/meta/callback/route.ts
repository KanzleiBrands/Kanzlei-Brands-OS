import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeMetaCode, exchangeForLongLivedUserToken } from "@/lib/meta/graph";
import { verifyAndClearMetaOAuthState } from "@/lib/meta/oauth-state";
import { storePendingConnection } from "@/lib/meta/pending-connection";

export async function GET(request: NextRequest) {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const verified = await verifyAndClearMetaOAuthState(state);
  if (oauthError || !verified || !code) {
    const target = verified
      ? `${baseUrl}/dashboard/pipelines/${verified.pipelineId}?tab=sources&error=meta_connect_failed`
      : `${baseUrl}/dashboard/pipelines`;
    return NextResponse.redirect(target);
  }

  try {
    const shortLived = await exchangeMetaCode(baseUrl, code);
    const longLived = await exchangeForLongLivedUserToken(shortLived.access_token);
    await storePendingConnection(verified.pipelineId, longLived.access_token);
    return NextResponse.redirect(`${baseUrl}/dashboard/pipelines/${verified.pipelineId}/connect-meta`);
  } catch (error) {
    console.error("Meta OAuth callback failed", error);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/pipelines/${verified.pipelineId}?tab=sources&error=meta_connect_failed`,
    );
  }
}
