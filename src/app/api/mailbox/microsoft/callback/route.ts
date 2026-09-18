import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeMicrosoftCode, fetchMicrosoftEmail } from "@/lib/mailbox/microsoft";
import { verifyAndClearOAuthState } from "@/lib/mailbox/oauth-state";
import { encryptToken } from "@/lib/auth-encryption";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const stateOk = await verifyAndClearOAuthState(state);
  if (!stateOk || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=mailbox&error=invalid_state`);
  }

  try {
    const tokens = await exchangeMicrosoftCode(baseUrl, code);
    if (!tokens.refresh_token) {
      throw new Error("No refresh token returned from Microsoft");
    }
    const email = await fetchMicrosoftEmail(tokens.access_token);

    await prisma.emailAccount.upsert({
      where: { userId_email: { userId: session.user.id, email } },
      update: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        userId: session.user.id,
        provider: "MICROSOFT",
        email,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=mailbox&connected=microsoft`);
  } catch (error) {
    console.error("Microsoft mailbox connect failed", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?tab=mailbox&error=connect_failed`);
  }
}
