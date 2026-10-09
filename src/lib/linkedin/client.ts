// Thin wrapper around the LinkedIn APIs needed for Social Media Content's
// own publisher: OAuth token exchange, listing the Organization (Company)
// Pages an admin can pick from, and publishing a post via the Posts API.
//
// Two distinct ways to connect a LinkedIn channel - see LinkedInChannelKind:
//
// IMPORTANT: organic posting on behalf of an Organization requires LinkedIn
// Marketing Developer Platform partnership approval (w_organization_social /
// rw_organization_admin are not self-serve scopes) - this client is built to
// the documented API shape, but calls will fail with an authorization error
// until that partnership is granted. See src/lib/social/publish.ts, which
// surfaces that failure onto the post instead of crashing the publish cron.
//
// Posting as a PERSONAL profile uses the much lighter-weight "Sign In with
// LinkedIn using OpenID Connect" + "Share on LinkedIn" products instead
// (scopes: openid, profile, w_member_social) - no partnership needed, just
// LinkedIn's standard app review, which is normally granted quickly.
const API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202405"; // LinkedIn-Version header, required by the versioned REST APIs below

export type LinkedInConnectKind = "ORGANIZATION" | "PERSONAL";

const LINKEDIN_SCOPES: Record<LinkedInConnectKind, string> = {
  ORGANIZATION: ["r_organization_admin", "rw_organization_admin", "w_organization_social"].join(" "),
  PERSONAL: ["openid", "profile", "w_member_social"].join(" "),
};

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/linkedin/callback`;
}

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

async function linkedInFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new LinkedInApiError(`LinkedIn API request failed: ${text}`, response.status);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function buildLinkedInAuthUrl(baseUrl: string, state: string, kind: LinkedInConnectKind): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES[kind]);
  return url.toString();
}

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  // Nur vorhanden, wenn die App ein API-Produkt mit 1-Jahres-Token-Refresh
  // freigeschaltet hat (z.B. Community Management API/Advertising API) -
  // ohne das liefert LinkedIn nur einen reinen 60-Tage-Access-Token.
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export async function exchangeLinkedInCode(baseUrl: string, code: string): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(baseUrl),
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  return linkedInFetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

/** Erneuert einen Access-Token über den Refresh-Token, ohne erneuten Login-Flow - siehe src/lib/linkedin/token.ts. */
export async function refreshLinkedInAccessToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  return linkedInFetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export type LinkedInPersonInfo = { urn: string; name: string };

/**
 * Das eigene Profil des gerade verbundenen LinkedIn-Nutzers über den
 * OpenID-Connect-Userinfo-Endpoint - liefert die Person-URN (aus "sub") und
 * den Anzeigenamen, ohne die (eingeschränkt vergebene) /v2/me-Berechtigung
 * zu brauchen. Es gibt für ein persönliches Profil keine Auswahl wie bei
 * Organisationen (eine Person hat nur sich selbst), daher kein "list*".
 */
export async function getLinkedInPersonInfo(accessToken: string): Promise<LinkedInPersonInfo> {
  const data = await linkedInFetch<{ sub: string; name?: string; given_name?: string; family_name?: string }>(
    `${API_BASE}/v2/userinfo`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const name = data.name ?? [data.given_name, data.family_name].filter(Boolean).join(" ") ?? data.sub;
  return { urn: `urn:li:person:${data.sub}`, name };
}

export type LinkedInOrganization = { urn: string; id: string; name: string };

/** Organization (Company) Pages the connected user administers - LinkedIn requires posting "as" a page's URN, not a personal profile. */
export async function listLinkedInOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
  const url = new URL(`${API_BASE}/v2/organizationAcls`);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("projection", "(elements*(*,organization~(localizedName)))");

  const data = await linkedInFetch<{
    elements: { organization: string; "organization~"?: { localizedName?: string } }[];
  }>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data.elements.map((el) => ({
    urn: el.organization,
    id: el.organization.split(":").pop() ?? el.organization,
    name: el["organization~"]?.localizedName ?? el.organization,
  }));
}

/**
 * Uploads an image to LinkedIn's asset store and returns its URN, for use as
 * a Post's media reference - LinkedIn (unlike Meta) needs the bytes uploaded
 * to it directly, it can't fetch our hosted mediaUrl itself. "owner" accepts
 * either an organization or a person URN - same shape either way.
 */
async function uploadLinkedInImage(accessToken: string, authorUrn: string, imageUrl: string): Promise<string> {
  const registerBody = {
    initializeUploadRequest: {
      owner: authorUrn,
    },
  };
  const registered = await linkedInFetch<{ value: { uploadUrl: string; image: string } }>(
    `${API_BASE}/rest/images?action=initializeUpload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(registerBody),
    },
  );

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new LinkedInApiError(`Konnte Bild nicht laden: ${imageUrl}`);
  const imageBytes = await imageResponse.arrayBuffer();

  const uploadResponse = await fetch(registered.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: imageBytes,
  });
  if (!uploadResponse.ok) throw new LinkedInApiError("Bild-Upload zu LinkedIn fehlgeschlagen.");

  return registered.value.image;
}

export type PublishedLinkedInPost = { id: string };

export async function publishLinkedInPost(params: {
  accessToken: string;
  /** Organization- oder Person-URN, je nach SocialChannel.linkedInKind - die Posts API behandelt beide gleich. */
  authorUrn: string;
  text: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL";
}): Promise<PublishedLinkedInPost> {
  const { accessToken, authorUrn, text, mediaUrl, mediaUrls, mediaType } = params;

  if (mediaType === "VIDEO") {
    throw new LinkedInApiError("LinkedIn-Video-Upload wird noch nicht unterstützt - Beitrag bitte ohne Video oder mit Bild planen.");
  }

  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaType === "CAROUSEL" && mediaUrls && mediaUrls.length > 0) {
    const imageUrns = await Promise.all(mediaUrls.map((url) => uploadLinkedInImage(accessToken, authorUrn, url)));
    body.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };
  } else if (mediaUrl && mediaType === "IMAGE") {
    const imageUrn = await uploadLinkedInImage(accessToken, authorUrn, mediaUrl);
    body.content = { media: { id: imageUrn } };
  }

  const response = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new LinkedInApiError(`LinkedIn-Post fehlgeschlagen: ${text}`, response.status);
  }

  // The Posts API returns the new post's URN in the x-restli-id response header, not the body.
  const postUrn = response.headers.get("x-restli-id") ?? response.headers.get("X-RestLi-Id") ?? "";
  return { id: postUrn };
}

// ---------------------------------------------------------------------------
// Social Media Content: Community Center (comments)
// ---------------------------------------------------------------------------
// LinkedIn exposes comment reading/replying/moderation via the Social Actions
// API (GET/POST /rest/socialActions/{shareUrn}/comments), but that's part of
// the separate Community Management API product - gated behind its own
// LinkedIn partner approval on top of what publishLinkedInPost above already
// needs, and historically harder to get granted than organic posting.
// These functions are built to that documented shape so wiring them in later
// is a drop-in swap, but they throw until access is granted - same pattern as
// the video-upload branch of publishLinkedInPost above.

export type LinkedInComment = { id: string; message: string; authorName?: string; createdAt: string };

function communityManagementApiUnavailable(): never {
  throw new LinkedInApiError(
    "Kommentar-Funktionen für LinkedIn sind noch nicht freigeschaltet - dafür ist zusätzlich zur Marketing Developer Platform die separate Community Management API nötig, deren Freigabe LinkedIn noch nicht erteilt hat.",
  );
}

export async function listLinkedInComments(_shareUrn: string, _accessToken: string): Promise<LinkedInComment[]> {
  communityManagementApiUnavailable();
}

export async function replyToLinkedInComment(
  _shareUrn: string,
  _accessToken: string,
  _message: string,
): Promise<{ id: string }> {
  communityManagementApiUnavailable();
}

export async function deleteLinkedInComment(_commentUrn: string, _accessToken: string): Promise<void> {
  communityManagementApiUnavailable();
}
