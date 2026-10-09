import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { LinkedInConnectKind } from "./client";

// Mirrors src/lib/meta/social-oauth-state.ts - the LinkedIn connect flow is
// likewise "for" a client organization, not one campaign.
const STATE_COOKIE = "linkedin_oauth_state";
const ORG_COOKIE = "linkedin_oauth_org_id";
const KIND_COOKIE = "linkedin_oauth_kind";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function createLinkedInOAuthState(organizationId: string, kind: LinkedInConnectKind): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, COOKIE_OPTIONS);
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
  store.set(KIND_COOKIE, kind, COOKIE_OPTIONS);
  return state;
}

export async function verifyAndClearLinkedInOAuthState(
  receivedState: string | null,
): Promise<{ organizationId: string; kind: LinkedInConnectKind } | null> {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const organizationId = store.get(ORG_COOKIE)?.value ?? null;
  const kindRaw = store.get(KIND_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  store.delete(ORG_COOKIE);
  store.delete(KIND_COOKIE);

  if (!expectedState || !receivedState || expectedState !== receivedState || !organizationId) return null;
  const kind: LinkedInConnectKind = kindRaw === "PERSONAL" ? "PERSONAL" : "ORGANIZATION";
  return { organizationId, kind };
}
