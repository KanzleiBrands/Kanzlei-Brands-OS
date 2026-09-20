import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";

// Holds the long-lived Meta USER access token between the OAuth callback and
// the page/form picker page (src/app/dashboard/pipelines/[pipelineId]/connect-meta) -
// short-lived and httpOnly like the mailbox oauth-state cookie, but encrypted
// since it carries a real credential rather than just a CSRF nonce.
const TOKEN_COOKIE = "meta_pending_user_token";
const PIPELINE_COOKIE = "meta_pending_pipeline_id";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function storePendingConnection(pipelineId: string, userAccessToken: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encryptToken(userAccessToken), COOKIE_OPTIONS);
  store.set(PIPELINE_COOKIE, pipelineId, COOKIE_OPTIONS);
}

export async function readPendingConnection(): Promise<{ pipelineId: string; userAccessToken: string } | null> {
  const store = await cookies();
  const encToken = store.get(TOKEN_COOKIE)?.value;
  const pipelineId = store.get(PIPELINE_COOKIE)?.value;
  if (!encToken || !pipelineId) return null;
  try {
    return { pipelineId, userAccessToken: decryptToken(encToken) };
  } catch {
    return null;
  }
}

export async function clearPendingConnection(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  store.delete(PIPELINE_COOKIE);
}
