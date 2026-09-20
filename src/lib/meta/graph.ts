// Thin wrapper around the Meta Graph API endpoints needed for the Lead Ads
// (Instant Forms) direct integration: OAuth token exchange, listing the
// Pages/Lead Forms an admin can pick from, subscribing a Page to the
// leadgen webhook, and fetching a single lead's answers once notified.
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const META_SCOPES = ["pages_show_list", "pages_manage_metadata", "pages_read_engagement", "leads_retrieval"].join(
  ",",
);

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/meta/callback`;
}

export function buildMetaAuthUrl(baseUrl: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

/** Thrown by Graph API calls so callers can special-case an invalid/expired token (code 190) without string-matching the message. */
export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly graphErrorCode?: number,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

async function graphFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    let code: number | undefined;
    try {
      code = (JSON.parse(text) as { error?: { code?: number } }).error?.code;
    } catch {
      // Body wasn't JSON - leave graphErrorCode undefined.
    }
    throw new MetaGraphError(`Meta Graph API request failed: ${text}`, code);
  }
  return JSON.parse(text) as T;
}

export async function exchangeMetaCode(
  baseUrl: string,
  code: string,
): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("code", code);
  return graphFetch(url.toString());
}

/** Short-lived user tokens are only valid ~1-2h; exchanging once for a long-lived one (~60 days) means the Page tokens derived from it stay valid without a further refresh step. */
export async function exchangeForLongLivedUserToken(
  shortLivedToken: string,
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  return graphFetch(url.toString());
}

export type MetaPage = { id: string; name: string; access_token: string };

export async function listMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  let nextUrl: string | null = (() => {
    const url = new URL(`${GRAPH_BASE}/me/accounts`);
    url.searchParams.set("access_token", userAccessToken);
    url.searchParams.set("fields", "id,name,access_token");
    return url.toString();
  })();

  while (nextUrl) {
    const data: { data: MetaPage[]; paging?: { next?: string } } = await graphFetch(nextUrl);
    pages.push(...data.data);
    nextUrl = data.paging?.next ?? null;
  }
  return pages;
}

export type MetaLeadForm = { id: string; name: string; status: string };

export async function listMetaLeadForms(pageId: string, pageAccessToken: string): Promise<MetaLeadForm[]> {
  const forms: MetaLeadForm[] = [];
  let nextUrl: string | null = (() => {
    const url = new URL(`${GRAPH_BASE}/${pageId}/leadgen_forms`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("fields", "id,name,status");
    return url.toString();
  })();

  while (nextUrl) {
    const data: { data: MetaLeadForm[]; paging?: { next?: string } } = await graphFetch(nextUrl);
    forms.push(...data.data);
    nextUrl = data.paging?.next ?? null;
  }
  return forms;
}

export async function subscribePageToLeadgenWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "leadgen");
  url.searchParams.set("access_token", pageAccessToken);
  await graphFetch(url.toString(), { method: "POST" });
}

export async function unsubscribePageFromLeadgenWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);
  await graphFetch(url.toString(), { method: "DELETE" });
}

export type MetaLeadFieldData = { name: string; values: string[] };
export type MetaLead = {
  id: string;
  created_time: string;
  field_data: MetaLeadFieldData[];
  form_id?: string;
  ad_id?: string;
};

export async function fetchMetaLead(leadgenId: string, pageAccessToken: string): Promise<MetaLead> {
  const url = new URL(`${GRAPH_BASE}/${leadgenId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "id,created_time,field_data,form_id,ad_id");
  return graphFetch(url.toString());
}
