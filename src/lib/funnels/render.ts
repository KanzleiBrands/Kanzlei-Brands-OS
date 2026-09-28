// Rendert einen FunnelStep zu Text + HTML für einen konkreten Kontakt.
// Bewusst kein vollwertiger Rich-Text-Editor/Branding-Template: Diese Mails
// werden über das echte Postfach eines Mitarbeiters versendet und sollen wie
// eine persönliche Nachricht wirken, nicht wie ein Marketing-Newsletter -
// siehe FunnelStep.bodyText in prisma/schema.prisma. Die einzige erlaubte
// Formatierung ist deshalb eine minimale Markdown-ähnliche Syntax
// (**fett**, *kursiv*, [Linktext](https://...)), die der Editor über seine
// Formatierungs-Leiste einfügt - kein <b>/<i>/<a> im gespeicherten Text.
const PLACEHOLDER_RE = /\{\{\s*(firstName|lastName|companyName)\s*\}\}/gi;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const MARKDOWN_BOLD_RE = /\*\*(.+?)\*\*/g;
const MARKDOWN_ITALIC_RE = /\*(.+?)\*/g;

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

// Bold zuerst, damit von den beiden Sternen eines **fett**-Paars keiner mehr
// übrig bleibt, den die Kursiv-Regel danach fälschlich als eigenes
// *kursiv*-Paar auffassen könnte.
function applyInlineFormatting(escapedText: string): string {
  return escapedText.replace(MARKDOWN_BOLD_RE, "<strong>$1</strong>").replace(MARKDOWN_ITALIC_RE, "<em>$1</em>");
}

function substitutePlaceholders(text: string, contact: RenderContactVars): string {
  return text.replace(PLACEHOLDER_RE, (_match, key: string) => {
    if (key === "firstName") return contact.firstName ?? "";
    if (key === "lastName") return contact.lastName ?? "";
    return contact.companyName ?? "";
  });
}

/** Escapes plain text, applies bold/italic markers, and turns `[Label](https://...)` into an `<a>` tag. */
function paragraphToHtml(paragraph: string, trackUrl: (url: string) => string): string {
  let html = "";
  let lastIndex = 0;
  for (const match of paragraph.matchAll(MARKDOWN_LINK_RE)) {
    const [full, label, url] = match;
    const index = match.index ?? 0;
    html += applyInlineFormatting(escapeHtml(paragraph.slice(lastIndex, index)));
    html += `<a href="${escapeHtml(trackUrl(url))}" style="color:#2563eb;text-decoration:underline;">${applyInlineFormatting(escapeHtml(label))}</a>`;
    lastIndex = index + full.length;
  }
  html += applyInlineFormatting(escapeHtml(paragraph.slice(lastIndex)));
  return html.replace(/\n/g, "<br>");
}

function renderBodyHtml(substitutedBody: string, trackUrl: (url: string) => string): string {
  const paragraphs = substitutedBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => `<p>${paragraphToHtml(p, trackUrl)}</p>`).join("\n");
}

function renderCtaHtml(ctaLabel: string | null, ctaUrl: string | null, trackUrl: (url: string) => string): string {
  if (!ctaLabel || !ctaUrl) return "";
  const href = escapeHtml(trackUrl(ctaUrl));
  return `\n<p><a href="${href}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;border-radius:6px;text-decoration:none;">${escapeHtml(ctaLabel)}</a></p>`;
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

  const text = substitutedBody
    .replace(MARKDOWN_LINK_RE, (_match, label: string, url: string) => `${label} (${url})`)
    .replace(MARKDOWN_BOLD_RE, "$1")
    .replace(MARKDOWN_ITALIC_RE, "$1");

  const bodyHtml = renderBodyHtml(substitutedBody, trackUrl) + renderCtaHtml(params.step.ctaLabel, params.step.ctaUrl, trackUrl);

  const pixelUrl = `${params.baseUrl}/api/track/open/${params.trackingToken}.png`;
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#111827;">\n${bodyHtml}\n</div><img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  return { subject, text, html };
}

/**
 * Wie renderFunnelStepEmail, aber ohne Klick-Tracking/Open-Pixel - für die
 * Vorschau im Editor (Agentur- wie Kundenansicht), wo nichts tatsächlich
 * versendet wird und ein echter Tracking-Token deshalb weder existiert noch
 * sinnvoll wäre.
 */
export function renderFunnelStepPreview(params: {
  step: { subject: string; bodyText: string; ctaLabel: string | null; ctaUrl: string | null };
  contact: RenderContactVars;
}): { subject: string; html: string } {
  const subject = substitutePlaceholders(params.step.subject, params.contact);
  const substitutedBody = substitutePlaceholders(params.step.bodyText, params.contact);
  const identity = (url: string) => url;

  const bodyHtml = renderBodyHtml(substitutedBody, identity) + renderCtaHtml(params.step.ctaLabel, params.step.ctaUrl, identity);
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#111827;">\n${bodyHtml}\n</div>`;

  return { subject, html };
}
