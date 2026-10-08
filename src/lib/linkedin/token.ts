import type { SocialChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";
import { refreshLinkedInAccessToken, LinkedInApiError } from "./client";

// Access tokens are refreshed a bit before they actually expire, so a
// publish/sync run started right at the boundary doesn't fail needlessly.
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a valid LinkedIn access token for a connected channel, refreshing
 * it via the stored refresh token (and persisting the new pair) when the
 * current one is close to expiry. Throws LinkedInApiError(401) - same shape
 * as a rejected token from the LinkedIn API itself - when the token is
 * expired and there's no refresh token to fall back on, so callers (e.g.
 * src/lib/social/publish.ts) can mark the channel inactive exactly like any
 * other 401 and prompt a reconnect.
 */
export async function getValidLinkedInAccessToken(channel: SocialChannel): Promise<string> {
  const expiresAt = channel.tokenExpiresAt;
  const stillValid = !expiresAt || expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (stillValid) return decryptToken(channel.accessTokenEnc);

  if (!channel.refreshTokenEnc) {
    throw new LinkedInApiError("LinkedIn-Zugriff abgelaufen - bitte erneut verbinden (kein Refresh-Token hinterlegt).", 401);
  }

  const refreshToken = decryptToken(channel.refreshTokenEnc);
  const refreshed = await refreshLinkedInAccessToken(refreshToken);

  await prisma.socialChannel.update({
    where: { id: channel.id },
    data: {
      accessTokenEnc: encryptToken(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      // LinkedIn kann bei jeder Erneuerung einen neuen Refresh-Token
      // ausgeben (rotierend) - falls nicht, den bestehenden behalten.
      ...(refreshed.refresh_token
        ? {
            refreshTokenEnc: encryptToken(refreshed.refresh_token),
            refreshTokenExpiresAt: refreshed.refresh_token_expires_in
              ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
              : channel.refreshTokenExpiresAt,
          }
        : {}),
    },
  });

  return refreshed.access_token;
}
