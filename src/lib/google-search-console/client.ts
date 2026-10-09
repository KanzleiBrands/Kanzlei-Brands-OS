/**
 * Google-Search-Console-Client für die SEO/GEO-Pipeline (v1, nur intern) -
 * liefert die kostenlose Grundlage für die Content-Lücken-Analyse
 * (src/lib/actions/seo-gaps.ts): eigene Suchanfragen mit Impressionen/Klicks/
 * Position, siehe https://developers.google.com/webmaster-tools/v1/searchanalytics/query.
 * OAuth-Ablauf spiegelt src/lib/mailbox/google.ts (gleiche Token-Tausch-/
 * Refresh-Mechanik, eigener Google-Cloud-Client statt Wiederverwendung des
 * Gmail-Clients - siehe GOOGLE_SEARCH_CONSOLE_CLIENT_ID in .env.example).
 */
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function redirectUri(baseUrl: string): string {
  return `${baseUrl}/api/seo/gsc/callback`;
}

export function buildGscAuthUrl(baseUrl: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(baseUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GSC_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

type GoogleTokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

export async function exchangeGscCode(baseUrl: string, code: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google-Search-Console-Token-Tausch fehlgeschlagen: ${await response.text()}`);
  return response.json();
}

async function refreshGscToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google-Search-Console-Token-Refresh fehlgeschlagen: ${await response.text()}`);
  return response.json();
}

/** Liefert einen gültigen Access-Token, erneuert ihn bei Bedarf und persistiert ihn. Wirft, wenn keine Verbindung besteht. */
export async function getValidGscAccessToken(): Promise<string> {
  const connection = await prisma.googleSearchConsoleConnection.findUnique({ where: { id: "singleton" } });
  if (!connection) throw new Error("Keine Google-Search-Console-Verbindung vorhanden.");

  const bufferMs = 60_000;
  if (connection.tokenExpiresAt.getTime() > Date.now() + bufferMs) {
    return decryptToken(connection.accessTokenEnc);
  }

  const refreshed = await refreshGscToken(decryptToken(connection.refreshTokenEnc));
  await prisma.googleSearchConsoleConnection.update({
    where: { id: "singleton" },
    data: {
      accessTokenEnc: encryptToken(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

export type GscSite = { siteUrl: string; permissionLevel: string };

/** Alle Properties, auf die der verbundene Google-Account Zugriff hat - für die Property-Auswahl nach dem Connect. */
export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google-Search-Console-Property-Abfrage fehlgeschlagen (${res.status})`);
  const data = (await res.json()) as { siteEntry?: GscSite[] };
  return data.siteEntry ?? [];
}

export type SearchAnalyticsRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };

/** Suchanfragen-Performance für den gegebenen Zeitraum - Grundlage der Content-Lücken-Analyse (siehe seo-gaps.ts). */
export async function querySearchAnalytics(
  siteUrl: string,
  accessToken: string,
  { startDate, endDate, rowLimit = 5000 }: { startDate: string; endDate: string; rowLimit?: number },
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit, dataState: "all" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google-Search-Console-Abfrage fehlgeschlagen (${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  const data = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
  return (data.rows ?? []).map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}
