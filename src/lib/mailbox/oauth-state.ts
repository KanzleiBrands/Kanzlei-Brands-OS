import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "mailbox_oauth_state";

export async function createOAuthState() {
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return state;
}

export async function verifyAndClearOAuthState(receivedState: string | null) {
  const store = await cookies();
  const expected = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  return !!expected && !!receivedState && expected === receivedState;
}
