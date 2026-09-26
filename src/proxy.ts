import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/activate",
  "/nutzungsbedingungen",
  "/datenloeschung",
  "/jobs",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/integrations",
  "/api/track",
];

// AGENCY_STAFF (Vertrieb, Backoffice, ... - siehe AgencyDepartment) hat keinen
// CRM-Zugriff, nur das interne Portal. Diese Pfade bleiben trotzdem erreichbar,
// weil sie geteilt sind (Schulung) oder das interne Portal selbst darstellen.
// /dashboard/pipelines und /dashboard/contacts gehören eigentlich zum
// Kundenportal, werden aber auch fürs interne Marketing-Center gebraucht
// (Kampagne + Kontakte fürs eigene E-Mail-Marketing) - assertPipelineAccess/
// accessiblePipelineIds (src/lib/access.ts) lassen Marketing-Mitarbeiter dort
// ausschließlich auf die eigene Organisation (nie einen Kunden) zu.
const AGENCY_STAFF_ALLOWED_PREFIXES = [
  "/dashboard/intern",
  "/dashboard/courses",
  "/dashboard/settings",
  "/dashboard/pipelines",
  "/dashboard/contacts",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isLoggedIn = !!req.auth;

  if (isPublic) {
    if (pathname === "/login" && isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
    return;
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth?.user?.role;

  // Internes Portal (Intranet) ist nur für Agentur-Mitarbeiter - Kunden
  // (CLIENT_ADMIN/CLIENT_STAFF) dürfen es unter keinen Umständen sehen.
  if (pathname.startsWith("/dashboard/intern") && role !== "AGENCY_ADMIN" && role !== "AGENCY_STAFF") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (role === "AGENCY_STAFF" && !AGENCY_STAFF_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/dashboard/intern", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
