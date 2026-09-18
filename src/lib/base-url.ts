import { headers } from "next/headers";

export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
