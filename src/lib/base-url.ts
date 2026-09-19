import { headers } from "next/headers";

// The platform's fixed production domain. Vercel preview deployments get a
// random per-deployment hostname that's protected by Vercel Authentication,
// so URLs shown to users (e.g. webhook targets) must always point here
// instead of reflecting whatever host the current request came in on.
const PRODUCTION_URL = "https://app.kanzlei-brands.de";

export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host?.includes("localhost")) return `http://${host}`;
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")) {
    return process.env.NEXTAUTH_URL;
  }
  return PRODUCTION_URL;
}
