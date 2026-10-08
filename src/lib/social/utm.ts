/**
 * Appends UTM tracking parameters to every link in a post's caption, so
 * traffic from this specific post is attributable in the client's Analytics.
 * Fully automatic and always the same shape - no manual input in the post
 * editor (utm_source=<platform>, utm_medium=socialpost, utm_campaign=<Post-ID>
 * als eindeutiger "welcher Post war das"-Identifikator).
 */
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function appendUtmParams(caption: string, platform: string, postId: string): string {
  return caption.replace(URL_PATTERN, (url) => {
    const separator = url.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      utm_source: platform.toLowerCase(),
      utm_medium: "socialpost",
      utm_campaign: postId,
    });
    return `${url}${separator}${params.toString()}`;
  });
}
