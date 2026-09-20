import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Mirrors src/lib/mailbox/oauth-state.ts, but additionally has to carry
// which pipeline the connection is for across the redirect round-trip - a
// mailbox connection is implicitly "for" the logged-in user, but a Meta
// connection is "for" one specific campaign the admin was looking at.
const STATE_COOKIE = "meta_oauth_state";
const PIPELINE_COOKIE = "meta_oauth_pipeline_id";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function createMetaOAuthState(pipelineId: string): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, COOKIE_OPTIONS);
  store.set(PIPELINE_COOKIE, pipelineId, COOKIE_OPTIONS);
  return state;
}

export async function verifyAndClearMetaOAuthState(
  receivedState: string | null,
): Promise<{ pipelineId: string } | null> {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const pipelineId = store.get(PIPELINE_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);
  store.delete(PIPELINE_COOKIE);

  if (!expectedState || !receivedState || expectedState !== receivedState || !pipelineId) return null;
  return { pipelineId };
}
