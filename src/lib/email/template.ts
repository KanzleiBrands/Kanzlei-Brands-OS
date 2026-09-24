/**
 * Shared branded look for transactional emails (Passwort zurücksetzen,
 * Zugangs-Einladung, Lead-/Bewerbungsbenachrichtigung, ...), sent via
 * sendSystemEmail. Table-based, inline-styled HTML so it renders
 * consistently across Gmail/Outlook/Apple Mail; a plain-text version is
 * derived automatically as the fallback part of the email.
 */

const NAVY = "#0c111a";
const GOLD = "#b9975b";
const CREAM = "#f6f1e9";
const MUTED = "#5b6472";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderBrandedEmail({
  baseUrl,
  preheader,
  heading,
  paragraphs,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  baseUrl: string;
  /** Short hidden preview text shown next to the subject in inbox lists. */
  preheader: string;
  /** The email's headline, e.g. "Moin Lukas," - already placeholder-substituted by the caller. */
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Small muted line under the main text, e.g. link-expiry or opt-out info. */
  footerNote?: string;
}): { html: string; text: string } {
  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${NAVY};">${escapeHtml(p)}</p>`,
    )
    .join("");

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
          <tr>
            <td style="border-radius:10px;background:${NAVY};">
              <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="background:${CREAM};padding:32px 24px;">
                <img src="${escapeHtml(baseUrl)}/brand/mark.jpg" width="48" height="48" alt="Kanzlei Brands" style="display:block;border-radius:10px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${NAVY};">
                  ${escapeHtml(heading)}
                </h1>
                ${paragraphsHtml}
                ${ctaHtml}
                ${footerNote ? `<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(footerNote)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #eee6d8;">
                <p style="margin:0;font-size:12px;color:${MUTED};">
                  <span style="color:${GOLD};font-weight:600;">Kanzlei Brands</span> &middot; diese E-Mail wurde automatisch von der Plattform gesendet.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    ...(ctaLabel && ctaUrl ? ["", `${ctaLabel}: ${ctaUrl}`] : []),
    ...(footerNote ? ["", footerNote] : []),
    "",
    "Kanzlei Brands",
  ].join("\n");

  return { html, text };
}
