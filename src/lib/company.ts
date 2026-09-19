// Domains that belong to a mailbox provider, not the sender's own company -
// never derive a "website" from these.
const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "gmx.at",
  "gmx.ch",
  "web.de",
  "t-online.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "yahoo.com",
  "yahoo.de",
  "icloud.com",
  "me.com",
  "aol.com",
  "freenet.de",
  "live.com",
  "protonmail.com",
  "mail.com",
  "posteo.de",
]);

/** Derives a company website from an email address's domain, unless it's a personal-mailbox provider. */
export function deriveWebsiteFromEmail(email: string | null): string | null {
  if (!email) return null;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null;
  return `https://${domain}`;
}
