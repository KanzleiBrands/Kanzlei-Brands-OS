const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/mailbox/google/callback`;
}

export function buildGoogleAuthUrl(baseUrl: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(baseUrl: string, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  }>;
}

export async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }
  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function fetchGoogleEmail(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info: ${await response.text()}`);
  }
  const data = (await response.json()) as { email: string };
  return data.email;
}

function encodeMimeMessage(params: { from: string; to: string; subject: string; text: string }) {
  const message = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.text,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

export type SyncedEmail = {
  providerMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fromAddress: string;
  toAddress: string;
  sentAt: Date;
};

function extractAddress(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  if (!first) return null;
  const angleMatch = first.match(/<([^>]+)>/);
  return (angleMatch ? angleMatch[1] : first).trim().toLowerCase();
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function findGmailBodyPart(part: GmailPart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) return part.body.data;
  for (const child of part.parts ?? []) {
    const found = findGmailBodyPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function decodeGmailBody(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Lists messages from the last `since` window (Gmail's INBOX+SENT labels
 * cover both directions in one search, unlike Microsoft Graph's folders).
 * Only fetches metadata for a bounded, recent window - full mailbox history
 * is never synced, and re-fetching an already-stored message is harmless
 * since callers dedupe on providerMessageId.
 */
export async function listGmailMessages(accessToken: string, since: Date): Promise<SyncedEmail[]> {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", `after:${Math.floor(since.getTime() / 1000)}`);
  listUrl.searchParams.set("maxResults", "50");
  const listResponse = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listResponse.ok) throw new Error(`Gmail list failed: ${await listResponse.text()}`);
  const list = (await listResponse.json()) as { messages?: { id: string }[] };
  if (!list.messages?.length) return [];

  const emails: SyncedEmail[] = [];
  for (const { id } of list.messages) {
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!msgResponse.ok) continue;
    const msg = (await msgResponse.json()) as {
      id: string;
      internalDate: string;
      labelIds?: string[];
      payload: GmailPart & { headers?: { name: string; value: string }[] };
    };
    const headers = msg.payload.headers ?? [];
    const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
    const from = extractAddress(header("From"));
    const to = extractAddress(header("To"));
    if (!from || !to) continue;

    const plainData = findGmailBodyPart(msg.payload, "text/plain");
    const htmlData = findGmailBodyPart(msg.payload, "text/html");

    emails.push({
      providerMessageId: msg.id,
      direction: msg.labelIds?.includes("SENT") ? "OUTBOUND" : "INBOUND",
      subject: header("Subject") ?? null,
      bodyText: plainData ? decodeGmailBody(plainData) : null,
      bodyHtml: htmlData ? decodeGmailBody(htmlData) : null,
      fromAddress: from,
      toAddress: to,
      sentAt: new Date(Number(msg.internalDate)),
    });
  }
  return emails;
}

export async function sendGmail(
  accessToken: string,
  params: { from: string; to: string; subject: string; text: string },
) {
  const raw = encodeMimeMessage(params);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!response.ok) {
    throw new Error(`Gmail send failed: ${await response.text()}`);
  }
  return response.json() as Promise<{ id: string }>;
}
