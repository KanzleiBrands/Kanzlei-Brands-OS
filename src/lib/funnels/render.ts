// Rendert einen FunnelStep zu Text + HTML für einen konkreten Kontakt.
// Bewusst kein Rich-Text-Editor/Branding-Template: Diese Mails werden über
// das echte Postfach eines Mitarbeiters versendet und sollen wie eine
// persönliche Nachricht wirken, nicht wie ein Marketing-Newsletter - siehe
// FunnelStep.bodyText in prisma/schema.prisma.
const PLACEHOLDER_RE = /\{\{\s*(firstName|lastName|companyName)\s*\}\}/gi;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type RenderContactVars = {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function substitutePlaceholders(text: string, contact: RenderContactVars): string {
  return text.replace(PLACEHOLDER_RE, (_match, key: string) => {
    if (key === "firstName") return contact.firstName ?? "";
    if (key === "lastName") return contact.lastName ?? "";
    return contact.companyName ?? "";
  });
}

/** Escapes plain text and turns `[Label](https://...)` into a tracked `<a>` tag. */
function paragraphToHtml(paragraph: string, trackUrl: (url: string) => string): string {
  let html = "";
  let lastIndex = 0;
  for (const match of paragraph.matchAll(MARKDOWN_LINK_RE)) {
    const [full, label, url] = match;
    const index = match.index ?? 0;
    html += escapeHtml(paragraph.slice(lastIndex, index));
    html += `<a href="${escapeHtml(trackUrl(url))}">${escapeHtml(label)}</a>`;
    lastIndex = index + full.length;
  }
  html += escapeHtml(paragraph.slice(lastIndex));
  return html.replace(/\n/g, "<br>");
}

export function renderFunnelStepEmail(params: {
  step: { subject: string; bodyText: string; ctaLabel: string | null; ctaUrl: string | null };
  contact: RenderContactVars;
  baseUrl: string;
  trackingToken: string;
}): { subject: string; text: string; html: string } {
  const subject = substitutePlaceholders(params.step.subject, params.contact);
  const substitutedBody = substitutePlaceholders(params.step.bodyText, params.contact);

  const trackUrl = (url: string) => `${params.baseUrl}/api/track/click/${params.trackingToken}?url=${encodeURIComponent(url)}`;

  const text = substitutedBody.replace(MARKDOWN_LINK_RE, (_match, label: string, url: string) => `${label} (${url})`);

  const paragraphs = substitutedBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let bodyHtml = paragraphs.map((p) => `<p>${paragraphToHtml(p, trackUrl)}</p>`).join("\n");

  if (params.step.ctaLabel && params.step.ctaUrl) {
    const href = escapeHtml(trackUrl(params.step.ctaUrl));
    bodyHtml += `\n<p><a href="${href}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;border-radius:6px;text-decoration:none;">${escapeHtml(params.step.ctaLabel)}</a></p>`;
  }

  const pixelUrl = `${params.baseUrl}/api/track/open/${params.trackingToken}.png`;
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#111827;">\n${bodyHtml}\n</div><img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  return { subject, text, html };
}
