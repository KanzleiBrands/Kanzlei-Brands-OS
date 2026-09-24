import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";

// Mirrors src/lib/meta/social-pending-connection.ts - holds the user access
// token between the OAuth callback and the Organization picker page.
const TOKEN_COOKIE = "linkedin_pending_user_token";
const ORG_COOKIE = "linkedin_pending_org_id";
const EXPIRES_COOKIE = "linkedin_pending_expires_at";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function storeLinkedInPendingConnection(
  organizationId: string,
  userAccessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encryptToken(userAccessToken), COOKIE_OPTIONS);
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
  store.set(EXPIRES_COOKIE, String(Date.now() + expiresInSeconds * 1000), COOKIE_OPTIONS);
}

export async function readLinkedInPendingConnection(): Promise<
  { organizationId: string; userAccessToken: string; expiresAt: Date } | null
> {
  const store = await cookies();
  const encToken = store.get(TOKEN_COOKIE)?.value;
  const organizationId = store.get(ORG_COOKIE)?.value;
  const expiresAtMs = store.get(EXPIRES_COOKIE)?.value;
  if (!encToken || !organizationId) return null;
  try {
    return {
      organizationId,
      userAccessToken: decryptToken(encToken),
      expiresAt: new Date(expiresAtMs ? Number(expiresAtMs) : Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  } catch {
    return null;
  }
}

export async function clearLinkedInPendingConnection(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  store.delete(ORG_COOKIE);
  store.delete(EXPIRES_COOKIE);
}
