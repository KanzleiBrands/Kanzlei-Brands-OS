// Thin wrapper around the Meta Graph API endpoints needed for the Lead Ads
// (Instant Forms) direct integration: OAuth token exchange, listing the
// Pages/Lead Forms an admin can pick from, subscribing a Page to the
// leadgen webhook, and fetching a single lead's answers once notified.
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// business_management is needed on top of pages_show_list because /me/accounts
// only ever returns Pages the user is a classic per-Page admin on. Pages a client
// only shared with our agency's Business Manager (Partner/"client page" access,
// the normal setup for this agency's customers) are invisible on /me/accounts and
// only show up via the /{business_id}/client_pages and /owned_pages edges below.
const META_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "leads_retrieval",
  "business_management",
].join(",");

// Additional permissions for Social Media Content's own publisher (Facebook
// Page posts + Instagram Content Publishing API) - separate from
// META_SCOPES/buildMetaAuthUrl above so the existing Lead-Ads connect flow
// keeps requesting only what it has always requested. Requires Meta App
// Review, same process already used to get META_SCOPES approved.
const SOCIAL_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "business_management",
].join(",");

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/meta/callback`;
}

function socialRedirectUri(baseUrl: string) {
  return `${baseUrl}/api/meta/social/callback`;
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

export function buildMetaSocialAuthUrl(baseUrl: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", socialRedirectUri(baseUrl));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SOCIAL_SCOPES);
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

export async function exchangeMetaSocialCode(
  baseUrl: string,
  code: string,
): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", socialRedirectUri(baseUrl));
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

/**
 * Fetches one Page directly by id instead of re-listing every Page the user
 * can reach (listAllMetaPages) - with hundreds of Business-Manager pages that
 * full re-list is slow enough to time out the Server Action, exactly the
 * "Anfrage an Facebook hat zu lange gedauert" the connect wizard shows.
 * Graph only returns access_token if the token holder actually has
 * sufficient permission on this specific Page, so this preserves the same
 * access check as re-deriving it from the full list.
 */
export async function getMetaPage(pageId: string, userAccessToken: string): Promise<MetaPage | null> {
  const url = new URL(`${GRAPH_BASE}/${pageId}`);
  url.searchParams.set("access_token", userAccessToken);
  url.searchParams.set("fields", "id,name,access_token");
  try {
    return await graphFetch<MetaPage>(url.toString());
  } catch (error) {
    if (error instanceof MetaGraphError) {
      console.error(`[meta] getMetaPage(${pageId}) failed:`, error.message, "code:", error.graphErrorCode);
      return null;
    }
    throw error;
  }
}

export async function listMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  let nextUrl: string | null = (() => {
    const url = new URL(`${GRAPH_BASE}/me/accounts`);
    url.searchParams.set("access_token", userAccessToken);
    url.searchParams.set("fields", "id,name,access_token");
    url.searchParams.set("limit", "100");
    return url.toString();
  })();

  while (nextUrl) {
    const data: { data: MetaPage[]; paging?: { next?: string } } = await graphFetch(nextUrl);
    pages.push(...data.data);
    nextUrl = data.paging?.next ?? null;
  }
  return pages;
}

async function paginate<T>(firstUrl: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = firstUrl;
  while (nextUrl) {
    const data: { data: T[]; paging?: { next?: string } } = await graphFetch(nextUrl);
    items.push(...data.data);
    nextUrl = data.paging?.next ?? null;
  }
  return items;
}

type MetaBusiness = { id: string; name: string };

async function listMetaBusinesses(userAccessToken: string): Promise<MetaBusiness[]> {
  const url = new URL(`${GRAPH_BASE}/me/businesses`);
  url.searchParams.set("access_token", userAccessToken);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("limit", "100");
  return paginate<MetaBusiness>(url.toString());
}

/** Pages a Business Manager owns directly, plus Pages a client shared with it as a Partner ("client pages") - together these cover every Page an agency typically manages for a customer without the customer ever adding the agency's users as classic per-Page admins. */
async function listPagesForBusiness(businessId: string, userAccessToken: string): Promise<MetaPage[]> {
  const edges = ["owned_pages", "client_pages"];
  const results = await Promise.all(
    edges.map(async (edge) => {
      const url = new URL(`${GRAPH_BASE}/${businessId}/${edge}`);
      url.searchParams.set("access_token", userAccessToken);
      url.searchParams.set("fields", "id,name,access_token");
      url.searchParams.set("limit", "100");
      try {
        return await paginate<MetaPage>(url.toString());
      } catch (error) {
        // Missing task/permission on this specific business+edge shouldn't
        // block the rest of the page list from loading.
        console.error(`[meta] failed to list ${edge} for business ${businessId}:`, error);
        return [];
      }
    }),
  );
  return results.flat();
}

/**
 * Every Page the user can act on: classic per-Page admins via /me/accounts,
 * plus everything reachable through any Business Manager they belong to
 * (owned or shared-as-client), deduplicated by Page id. See META_SCOPES
 * comment above for why /me/accounts alone misses most of this agency's
 * client Pages.
 */
export async function listAllMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const [personalPages, businesses] = await Promise.all([
    listMetaPages(userAccessToken),
    listMetaBusinesses(userAccessToken).catch((error) => {
      console.error("[meta] failed to list businesses:", error);
      return [] as MetaBusiness[];
    }),
  ]);

  const businessPages = (
    await Promise.all(businesses.map((business) => listPagesForBusiness(business.id, userAccessToken)))
  ).flat();

  const byId = new Map<string, MetaPage>();
  for (const page of [...personalPages, ...businessPages]) {
    if (page.access_token) byId.set(page.id, page);
  }
  return [...byId.values()];
}

export type MetaLeadForm = { id: string; name: string; status: string };

export async function listMetaLeadForms(pageId: string, pageAccessToken: string): Promise<MetaLeadForm[]> {
  const forms: MetaLeadForm[] = [];
  let nextUrl: string | null = (() => {
    const url = new URL(`${GRAPH_BASE}/${pageId}/leadgen_forms`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("fields", "id,name,status");
    url.searchParams.set("limit", "100");
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

// ---------------------------------------------------------------------------
// Social Media Content: publishing (Facebook Pages + Instagram)
// ---------------------------------------------------------------------------

/** The Instagram professional account linked to a Facebook Page, if any - required for Instagram Content Publishing. */
export async function getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<{ id: string; username?: string } | null> {
  const url = new URL(`${GRAPH_BASE}/${pageId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "instagram_business_account{id,username}");
  const data = await graphFetch<{ instagram_business_account?: { id: string; username?: string } }>(url.toString());
  return data.instagram_business_account ?? null;
}

export type PublishedPost = { id: string; permalink?: string };

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls a video media container until Instagram finishes transcoding it (or times out after ~2 minutes). */
async function waitForInstagramContainerReady(containerId: string, pageAccessToken: string): Promise<void> {
  const POLL_INTERVAL_MS = 5000;
  const MAX_ATTEMPTS = 24;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const url = new URL(`${GRAPH_BASE}/${containerId}`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("fields", "status_code");
    const { status_code } = await graphFetch<{ status_code?: string }>(url.toString());
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") throw new MetaGraphError("Instagram-Video konnte nicht verarbeitet werden.");
    await sleep(POLL_INTERVAL_MS);
  }
  throw new MetaGraphError("Instagram-Video-Verarbeitung hat zu lange gedauert.");
}

/**
 * Publishes a post to a Facebook Page - a plain text post via /feed when
 * there's no media, a photo post via /photos, or a video post via /videos
 * (Graph fetches the media itself from mediaUrl rather than us uploading
 * bytes, since our media already lives at a public URL).
 */
export async function publishFacebookPost(params: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "VIDEO";
}): Promise<PublishedPost> {
  const { pageId, pageAccessToken, message, mediaUrl, mediaType } = params;

  if (mediaUrl && mediaType === "IMAGE") {
    const url = new URL(`${GRAPH_BASE}/${pageId}/photos`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("url", mediaUrl);
    url.searchParams.set("caption", message);
    const result = await graphFetch<{ id: string; post_id?: string }>(url.toString(), { method: "POST" });
    const postId = result.post_id ?? result.id;
    return { id: postId, permalink: `https://www.facebook.com/${postId}` };
  }

  if (mediaUrl && mediaType === "VIDEO") {
    const url = new URL(`${GRAPH_BASE}/${pageId}/videos`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("file_url", mediaUrl);
    url.searchParams.set("description", message);
    const result = await graphFetch<{ id: string }>(url.toString(), { method: "POST" });
    return { id: result.id, permalink: `https://www.facebook.com/${result.id}` };
  }

  const url = new URL(`${GRAPH_BASE}/${pageId}/feed`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("message", message);
  const result = await graphFetch<{ id: string }>(url.toString(), { method: "POST" });
  return { id: result.id, permalink: `https://www.facebook.com/${result.id}` };
}

/**
 * Publishes to an Instagram professional account via the two-step Content
 * Publishing flow: create a media container, then publish it. Instagram
 * (unlike Facebook) has no text-only post type - media is required.
 */
export async function publishInstagramPost(params: {
  igUserId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
}): Promise<PublishedPost> {
  const { igUserId, pageAccessToken, caption, mediaUrl, mediaType } = params;

  const createUrl = new URL(`${GRAPH_BASE}/${igUserId}/media`);
  createUrl.searchParams.set("access_token", pageAccessToken);
  createUrl.searchParams.set("caption", caption);
  if (mediaType === "VIDEO") {
    createUrl.searchParams.set("media_type", "REELS");
    createUrl.searchParams.set("video_url", mediaUrl);
  } else {
    createUrl.searchParams.set("image_url", mediaUrl);
  }
  const created = await graphFetch<{ id: string }>(createUrl.toString(), { method: "POST" });

  // Video containers process asynchronously - media_publish fails with "media
  // not ready" if called before Instagram finishes transcoding, so poll
  // status_code first (images are ready immediately, no container status).
  if (mediaType === "VIDEO") {
    await waitForInstagramContainerReady(created.id, pageAccessToken);
  }

  const publishUrl = new URL(`${GRAPH_BASE}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("access_token", pageAccessToken);
  publishUrl.searchParams.set("creation_id", created.id);
  const published = await graphFetch<{ id: string }>(publishUrl.toString(), { method: "POST" });

  const permalinkUrl = new URL(`${GRAPH_BASE}/${published.id}`);
  permalinkUrl.searchParams.set("access_token", pageAccessToken);
  permalinkUrl.searchParams.set("fields", "permalink");
  const withPermalink = await graphFetch<{ permalink?: string }>(permalinkUrl.toString()).catch(
    () => ({ permalink: undefined }) as { permalink?: string },
  );

  return { id: published.id, permalink: withPermalink.permalink };
}

/**
 * Publishes a multi-photo Facebook Page post: each image is first uploaded
 * as an unpublished photo (published=false) to get a media fbid, then all
 * fbids are attached to a single /feed post - the documented way to get a
 * Facebook carousel/multi-photo post instead of several separate posts.
 */
export async function publishFacebookCarousel(params: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  mediaUrls: string[];
}): Promise<PublishedPost> {
  const { pageId, pageAccessToken, message, mediaUrls } = params;

  const photoIds = await Promise.all(
    mediaUrls.map(async (mediaUrl) => {
      const url = new URL(`${GRAPH_BASE}/${pageId}/photos`);
      url.searchParams.set("access_token", pageAccessToken);
      url.searchParams.set("url", mediaUrl);
      url.searchParams.set("published", "false");
      const result = await graphFetch<{ id: string }>(url.toString(), { method: "POST" });
      return result.id;
    }),
  );

  const feedUrl = new URL(`${GRAPH_BASE}/${pageId}/feed`);
  feedUrl.searchParams.set("access_token", pageAccessToken);
  feedUrl.searchParams.set("message", message);
  feedUrl.searchParams.set("attached_media", JSON.stringify(photoIds.map((id) => ({ media_fbid: id }))));
  const result = await graphFetch<{ id: string }>(feedUrl.toString(), { method: "POST" });
  return { id: result.id, permalink: `https://www.facebook.com/${result.id}` };
}

/**
 * Publishes an Instagram carousel (2-10 images): each image becomes an
 * unpublished "carousel item" child container, then a parent container of
 * media_type CAROUSEL references all children and is published as a whole -
 * same Content Publishing API as publishInstagramPost, one extra layer.
 */
export async function publishInstagramCarousel(params: {
  igUserId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrls: string[];
}): Promise<PublishedPost> {
  const { igUserId, pageAccessToken, caption, mediaUrls } = params;

  const childIds = await Promise.all(
    mediaUrls.map(async (mediaUrl) => {
      const url = new URL(`${GRAPH_BASE}/${igUserId}/media`);
      url.searchParams.set("access_token", pageAccessToken);
      url.searchParams.set("image_url", mediaUrl);
      url.searchParams.set("is_carousel_item", "true");
      const result = await graphFetch<{ id: string }>(url.toString(), { method: "POST" });
      return result.id;
    }),
  );

  const createUrl = new URL(`${GRAPH_BASE}/${igUserId}/media`);
  createUrl.searchParams.set("access_token", pageAccessToken);
  createUrl.searchParams.set("caption", caption);
  createUrl.searchParams.set("media_type", "CAROUSEL");
  createUrl.searchParams.set("children", childIds.join(","));
  const created = await graphFetch<{ id: string }>(createUrl.toString(), { method: "POST" });

  const publishUrl = new URL(`${GRAPH_BASE}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("access_token", pageAccessToken);
  publishUrl.searchParams.set("creation_id", created.id);
  const published = await graphFetch<{ id: string }>(publishUrl.toString(), { method: "POST" });

  const permalinkUrl = new URL(`${GRAPH_BASE}/${published.id}`);
  permalinkUrl.searchParams.set("access_token", pageAccessToken);
  permalinkUrl.searchParams.set("fields", "permalink");
  const withPermalink = await graphFetch<{ permalink?: string }>(permalinkUrl.toString()).catch(
    () => ({ permalink: undefined }) as { permalink?: string },
  );

  return { id: published.id, permalink: withPermalink.permalink };
}

// ---------------------------------------------------------------------------
// Social Media Content: Analytics (post insights)
// ---------------------------------------------------------------------------

export type SocialPostInsights = {
  impressions?: number;
  reach?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  clickCount?: number;
};

type MetaInsightMetric = { name: string; values?: { value: number }[]; total_value?: { value: number } };

/** Combines Page Insights (reach/impressions/clicks) with plain post fields (likes/comments/shares) - Graph splits these across two endpoints. */
export async function fetchFacebookPostInsights(postId: string, pageAccessToken: string): Promise<SocialPostInsights> {
  const insightsUrl = new URL(`${GRAPH_BASE}/${postId}/insights`);
  insightsUrl.searchParams.set("access_token", pageAccessToken);
  insightsUrl.searchParams.set("metric", "post_impressions,post_impressions_unique,post_clicks");
  const insights = await graphFetch<{ data: MetaInsightMetric[] }>(insightsUrl.toString()).catch(() => ({ data: [] }));
  const metricValue = (name: string) => insights.data.find((m) => m.name === name)?.values?.[0]?.value;

  const fieldsUrl = new URL(`${GRAPH_BASE}/${postId}`);
  fieldsUrl.searchParams.set("access_token", pageAccessToken);
  fieldsUrl.searchParams.set("fields", "shares,likes.summary(true),comments.summary(true)");
  type PostFields = {
    shares?: { count: number };
    likes?: { summary?: { total_count: number } };
    comments?: { summary?: { total_count: number } };
  };
  const fields = await graphFetch<PostFields>(fieldsUrl.toString()).catch(() => ({}) as PostFields);

  return {
    impressions: metricValue("post_impressions"),
    reach: metricValue("post_impressions_unique"),
    clickCount: metricValue("post_clicks"),
    likeCount: fields.likes?.summary?.total_count,
    commentCount: fields.comments?.summary?.total_count,
    shareCount: fields.shares?.count,
  };
}

/** Instagram media insights - which metrics are valid depends on media_product_type (feed/reel/carousel), so a failure of the whole call is swallowed rather than failing the sync for one post. */
export async function fetchInstagramMediaInsights(mediaId: string, pageAccessToken: string): Promise<SocialPostInsights> {
  const url = new URL(`${GRAPH_BASE}/${mediaId}/insights`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("metric", "reach,likes,comments,shares,saved");
  try {
    const result = await graphFetch<{ data: MetaInsightMetric[] }>(url.toString());
    const metricValue = (name: string) => {
      const metric = result.data.find((m) => m.name === name);
      return metric?.values?.[0]?.value ?? metric?.total_value?.value;
    };
    return {
      reach: metricValue("reach"),
      likeCount: metricValue("likes"),
      commentCount: metricValue("comments"),
      shareCount: metricValue("shares"),
    };
  } catch (error) {
    if (error instanceof MetaGraphError) return {};
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Social Media Content: Community Center (comments)
// ---------------------------------------------------------------------------

export type MetaComment = {
  id: string;
  message: string;
  from?: { id: string; name?: string; username?: string };
  created_time: string;
  parent?: { id: string };
};

/** Every top-level + nested comment on a Facebook Page post. */
export async function listFacebookComments(postId: string, pageAccessToken: string): Promise<MetaComment[]> {
  const url = new URL(`${GRAPH_BASE}/${postId}/comments`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "id,message,from,created_time,parent");
  url.searchParams.set("filter", "stream"); // includes replies, not just top-level
  url.searchParams.set("limit", "100");
  return paginate<MetaComment>(url.toString());
}

/** Every comment on an Instagram media object. */
export async function listInstagramComments(mediaId: string, pageAccessToken: string): Promise<MetaComment[]> {
  const url = new URL(`${GRAPH_BASE}/${mediaId}/comments`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "id,text,username,timestamp");
  url.searchParams.set("limit", "100");
  const raw = await paginate<{ id: string; text: string; username?: string; timestamp: string }>(url.toString());
  // Normalize Instagram's slightly different field names (text/username/timestamp) onto the same shape as Facebook.
  return raw.map((c) => ({ id: c.id, message: c.text, from: { id: c.id, username: c.username }, created_time: c.timestamp }));
}

/** Replies to a comment - a plain top-level comment reply for Facebook, or a Page/IG reply either way ends up as a new comment/reply object. */
export async function replyToFacebookComment(commentId: string, pageAccessToken: string, message: string): Promise<{ id: string }> {
  const url = new URL(`${GRAPH_BASE}/${commentId}/comments`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("message", message);
  return graphFetch(url.toString(), { method: "POST" });
}

export async function replyToInstagramComment(commentId: string, pageAccessToken: string, message: string): Promise<{ id: string }> {
  const url = new URL(`${GRAPH_BASE}/${commentId}/replies`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("message", message);
  return graphFetch(url.toString(), { method: "POST" });
}

export async function setFacebookCommentHidden(commentId: string, pageAccessToken: string, hidden: boolean): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${commentId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("is_hidden", String(hidden));
  await graphFetch(url.toString(), { method: "POST" });
}

export async function setInstagramCommentHidden(commentId: string, pageAccessToken: string, hidden: boolean): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${commentId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("hide", String(hidden));
  await graphFetch(url.toString(), { method: "POST" });
}

export async function deleteMetaComment(commentId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${commentId}`);
  url.searchParams.set("access_token", pageAccessToken);
  await graphFetch(url.toString(), { method: "DELETE" });
}

/** Subscribes a Page to feed (comment) events, alongside its existing leadgen subscription if any. */
export async function subscribePageToFeedWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "feed");
  url.searchParams.set("access_token", pageAccessToken);
  await graphFetch(url.toString(), { method: "POST" });
}
