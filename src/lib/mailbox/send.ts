import type { EmailAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";
import { refreshGoogleToken, sendGmail } from "@/lib/mailbox/google";
import { refreshMicrosoftToken, sendMicrosoftMail } from "@/lib/mailbox/microsoft";

async function getValidAccessToken(account: EmailAccount): Promise<string> {
  const bufferMs = 60_000;
  if (account.expiresAt.getTime() > Date.now() + bufferMs) {
    return decryptToken(account.accessTokenEnc);
  }

  const refreshToken = decryptToken(account.refreshTokenEnc);
  if (account.provider === "GOOGLE") {
    const refreshed = await refreshGoogleToken(refreshToken);
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEnc: encryptToken(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    return refreshed.access_token;
  }

  const refreshed = await refreshMicrosoftToken(refreshToken);
  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptToken(refreshed.access_token),
      ...(refreshed.refresh_token ? { refreshTokenEnc: encryptToken(refreshed.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

export async function sendEmailViaAccount(
  account: EmailAccount,
  params: { to: string; subject: string; text: string },
) {
  const accessToken = await getValidAccessToken(account);
  if (account.provider === "GOOGLE") {
    const result = await sendGmail(accessToken, { ...params, from: account.email });
    return result.id;
  }
  await sendMicrosoftMail(accessToken, params);
  return `msgraph-${Date.now()}`;
}
