/**
 * Appends UTM tracking parameters to every link in a post's caption, so
 * traffic from this specific post is attributable in the client's Analytics
 * (utm_source/utm_medium are derived from the platform, only the campaign
 * name is chosen by the agency per post - same "dynamic source" convention
 * SocialPilot uses). A post without a chosen campaign, or without any link
 * in its caption, is returned unchanged.
 */
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function appendUtmParams(caption: string, platform: string, campaign: string | null | undefined): string {
  if (!campaign) return caption;

  return caption.replace(URL_PATTERN, (url) => {
    const separator = url.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      utm_source: platform.toLowerCase(),
      utm_medium: "social",
      utm_campaign: campaign,
    });
    return `${url}${separator}${params.toString()}`;
  });
}
