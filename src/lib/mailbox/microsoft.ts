const MICROSOFT_SCOPES = ["openid", "email", "offline_access", "Mail.Send", "Mail.Read"].join(" ");

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/mailbox/microsoft/callback`;
}

export function buildMicrosoftAuthUrl(baseUrl: string, state: string) {
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeMicrosoftCode(baseUrl: string, code: string) {
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${await response.text()}`);
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function refreshMicrosoftToken(refreshToken: string) {
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

import type { SyncedEmail } from "./google";

type GraphMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  body?: { contentType?: string; content?: string };
  receivedDateTime?: string;
  sentDateTime?: string;
};

async function listMicrosoftFolder(
  accessToken: string,
  folder: string,
  since: Date,
  direction: "INBOUND" | "OUTBOUND",
): Promise<SyncedEmail[]> {
  const url = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`);
  url.searchParams.set("$filter", `receivedDateTime ge ${since.toISOString()}`);
  url.searchParams.set("$select", "id,subject,from,toRecipients,body,receivedDateTime,sentDateTime");
  url.searchParams.set("$top", "50");
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Microsoft list (${folder}) failed: ${await response.text()}`);
  const data = (await response.json()) as { value: GraphMessage[] };

  const emails: SyncedEmail[] = [];
  for (const msg of data.value) {
    const from = msg.from?.emailAddress?.address?.toLowerCase();
    const to = msg.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();
    if (!from || !to) continue;
    emails.push({
      providerMessageId: msg.id,
      direction,
      subject: msg.subject ?? null,
      bodyText: msg.body?.contentType === "text" ? (msg.body.content ?? null) : null,
      bodyHtml: msg.body?.contentType === "html" ? (msg.body.content ?? null) : null,
      fromAddress: from,
      toAddress: to,
      sentAt: new Date(msg.receivedDateTime ?? msg.sentDateTime ?? Date.now()),
    });
  }
  return emails;
}

/** Graph's /messages only covers Inbox by default - Sent Items needs its own folder query to see outbound correspondence too. */
export async function listMicrosoftMessages(accessToken: string, since: Date): Promise<SyncedEmail[]> {
  const [inbox, sent] = await Promise.all([
    listMicrosoftFolder(accessToken, "inbox", since, "INBOUND"),
    listMicrosoftFolder(accessToken, "sentitems", since, "OUTBOUND"),
  ]);
  return [...inbox, ...sent];
}

export async function fetchMicrosoftEmail(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Microsoft user info: ${await response.text()}`);
  }
  const data = (await response.json()) as { mail?: string; userPrincipalName: string };
  return data.mail ?? data.userPrincipalName;
}

export async function sendMicrosoftMail(
  accessToken: string,
  params: { to: string; subject: string; text: string; html?: string },
) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: params.html ? { contentType: "HTML", content: params.html } : { contentType: "Text", content: params.text },
        toRecipients: [{ emailAddress: { address: params.to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft sendMail failed: ${await response.text()}`);
  }
}
