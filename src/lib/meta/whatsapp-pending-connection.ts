import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";

// Mirrors src/lib/meta/social-pending-connection.ts for the WhatsApp connect flow.
const TOKEN_COOKIE = "meta_whatsapp_pending_user_token";
const ORG_COOKIE = "meta_whatsapp_pending_org_id";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function storeWhatsAppPendingConnection(organizationId: string, userAccessToken: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encryptToken(userAccessToken), COOKIE_OPTIONS);
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
}

export async function readWhatsAppPendingConnection(): Promise<{ organizationId: string; userAccessToken: string } | null> {
  const store = await cookies();
  const encToken = store.get(TOKEN_COOKIE)?.value;
  const organizationId = store.get(ORG_COOKIE)?.value;
  if (!encToken || !organizationId) return null;
  try {
    return { organizationId, userAccessToken: decryptToken(encToken) };
  } catch {
    return null;
  }
}

export async function clearWhatsAppPendingConnection(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  store.delete(ORG_COOKIE);
}
