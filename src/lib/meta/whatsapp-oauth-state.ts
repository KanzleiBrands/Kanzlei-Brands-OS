import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Mirrors src/lib/meta/social-oauth-state.ts for the WhatsApp connect flow.
const STATE_COOKIE = "meta_whatsapp_oauth_state";
const ORG_COOKIE = "meta_whatsapp_oauth_org_id";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function createMetaWhatsAppOAuthState(organizationId: string): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, COOKIE_OPTIONS);
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
  return state;
}

export async function verifyAndClearMetaWhatsAppOAuthState(
  receivedState: string | null,
): Promise<{ organizationId: string } | null> {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const organizationId = store.get(ORG_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);
  store.delete(ORG_COOKIE);

  if (!expectedState || !receivedState || expectedState !== receivedState || !organizationId) return null;
  return { organizationId };
}
