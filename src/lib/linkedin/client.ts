// Thin wrapper around the LinkedIn APIs needed for Social Media Content's
// own publisher: OAuth token exchange, listing the Organization (Company)
// Pages an admin can pick from, and publishing a post via the Posts API.
//
// IMPORTANT: organic posting on behalf of an Organization requires LinkedIn
// Marketing Developer Platform partnership approval (w_organization_social /
// rw_organization_admin are not self-serve scopes) - this client is built to
// the documented API shape, but calls will fail with an authorization error
// until that partnership is granted. See src/lib/social/publish.ts, which
// surfaces that failure onto the post instead of crashing the publish cron.
const API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202405"; // LinkedIn-Version header, required by the versioned REST APIs below

const LINKEDIN_SCOPES = ["r_organization_admin", "rw_organization_admin", "w_organization_social"].join(" ");

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

export function buildLinkedInAuthUrl(baseUrl: string, state: string): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES);
  return url.toString();
}

export async function exchangeLinkedInCode(
  baseUrl: string,
  code: string,
): Promise<{ access_token: string; expires_in: number }> {
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
 * to it directly, it can't fetch our hosted mediaUrl itself.
 */
async function uploadLinkedInImage(accessToken: string, organizationUrn: string, imageUrl: string): Promise<string> {
  const registerBody = {
    initializeUploadRequest: {
      owner: organizationUrn,
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
  organizationUrn: string;
  text: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL";
}): Promise<PublishedLinkedInPost> {
  const { accessToken, organizationUrn, text, mediaUrl, mediaUrls, mediaType } = params;

  if (mediaType === "VIDEO") {
    throw new LinkedInApiError("LinkedIn-Video-Upload wird noch nicht unterstützt - Beitrag bitte ohne Video oder mit Bild planen.");
  }

  const body: Record<string, unknown> = {
    author: organizationUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaType === "CAROUSEL" && mediaUrls && mediaUrls.length > 0) {
    const imageUrns = await Promise.all(mediaUrls.map((url) => uploadLinkedInImage(accessToken, organizationUrn, url)));
    body.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };
  } else if (mediaUrl && mediaType === "IMAGE") {
    const imageUrn = await uploadLinkedInImage(accessToken, organizationUrn, mediaUrl);
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
