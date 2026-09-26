import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeMetaWhatsAppCode, exchangeForLongLivedUserToken } from "@/lib/meta/graph";
import { verifyAndClearMetaWhatsAppOAuthState } from "@/lib/meta/whatsapp-oauth-state";
import { storeWhatsAppPendingConnection } from "@/lib/meta/whatsapp-pending-connection";

export async function GET(request: NextRequest) {
  await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const verified = await verifyAndClearMetaWhatsAppOAuthState(state);
  if (oauthError || !verified || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=meta_connect_failed`);
  }

  try {
    const shortLived = await exchangeMetaWhatsAppCode(baseUrl, code);
    const longLived = await exchangeForLongLivedUserToken(shortLived.access_token);
    await storeWhatsAppPendingConnection(verified.organizationId, longLived.access_token);
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp/connect`);
  } catch (error) {
    console.error("Meta WhatsApp OAuth callback failed", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=meta_connect_failed`);
  }
}
