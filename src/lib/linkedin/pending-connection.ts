import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";
import type { LinkedInConnectKind } from "./client";

// Mirrors src/lib/meta/social-pending-connection.ts - holds the user access
// token between the OAuth callback and the Organization/Profil picker page.
const TOKEN_COOKIE = "linkedin_pending_user_token";
const ORG_COOKIE = "linkedin_pending_org_id";
const KIND_COOKIE = "linkedin_pending_kind";
const EXPIRES_COOKIE = "linkedin_pending_expires_at";
const REFRESH_TOKEN_COOKIE = "linkedin_pending_refresh_token";
const REFRESH_EXPIRES_COOKIE = "linkedin_pending_refresh_expires_at";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function storeLinkedInPendingConnection(
  organizationId: string,
  kind: LinkedInConnectKind,
  userAccessToken: string,
  expiresInSeconds: number,
  refreshToken?: string,
  refreshTokenExpiresInSeconds?: number,
): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encryptToken(userAccessToken), COOKIE_OPTIONS);
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
  store.set(KIND_COOKIE, kind, COOKIE_OPTIONS);
  store.set(EXPIRES_COOKIE, String(Date.now() + expiresInSeconds * 1000), COOKIE_OPTIONS);
  if (refreshToken) {
    store.set(REFRESH_TOKEN_COOKIE, encryptToken(refreshToken), COOKIE_OPTIONS);
    if (refreshTokenExpiresInSeconds) {
      store.set(REFRESH_EXPIRES_COOKIE, String(Date.now() + refreshTokenExpiresInSeconds * 1000), COOKIE_OPTIONS);
    }
  }
}

export async function readLinkedInPendingConnection(): Promise<
  | {
      organizationId: string;
      kind: LinkedInConnectKind;
      userAccessToken: string;
      expiresAt: Date;
      refreshToken: string | null;
      refreshTokenExpiresAt: Date | null;
    }
  | null
> {
  const store = await cookies();
  const encToken = store.get(TOKEN_COOKIE)?.value;
  const organizationId = store.get(ORG_COOKIE)?.value;
  const kindRaw = store.get(KIND_COOKIE)?.value;
  const expiresAtMs = store.get(EXPIRES_COOKIE)?.value;
  const encRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const refreshExpiresAtMs = store.get(REFRESH_EXPIRES_COOKIE)?.value;
  if (!encToken || !organizationId) return null;
  try {
    return {
      organizationId,
      kind: kindRaw === "PERSONAL" ? "PERSONAL" : "ORGANIZATION",
      userAccessToken: decryptToken(encToken),
      expiresAt: new Date(expiresAtMs ? Number(expiresAtMs) : Date.now() + 60 * 24 * 60 * 60 * 1000),
      refreshToken: encRefreshToken ? decryptToken(encRefreshToken) : null,
      refreshTokenExpiresAt: refreshExpiresAtMs ? new Date(Number(refreshExpiresAtMs)) : null,
    };
  } catch {
    return null;
  }
}

export async function clearLinkedInPendingConnection(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  store.delete(ORG_COOKIE);
  store.delete(KIND_COOKIE);
  store.delete(EXPIRES_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  store.delete(REFRESH_EXPIRES_COOKIE);
}
