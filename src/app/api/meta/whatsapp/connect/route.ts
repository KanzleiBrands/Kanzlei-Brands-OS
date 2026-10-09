import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildMetaWhatsAppAuthUrl } from "@/lib/meta/graph";
import { createMetaWhatsAppOAuthState } from "@/lib/meta/whatsapp-oauth-state";

// Nur Agentur-Admins dürfen das einrichten - die WhatsApp-Nummer wird immer
// von der Agentur manuell pro Kunde verbunden (kein Self-Service-Connect für
// Kunden selbst, anders als bei Meta-Social/LinkedIn). Ohne organizationId
// verbindet die Nummer der Agentur selbst (internes Marketing-Center,
// bisheriges Verhalten) - mit organizationId (+ optional pipelineId) die
// Nummer eines Kunden für dessen WhatsApp-Marketing/Recruiting-Reiter.
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();

  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=no_permission`);
  }

  if (!process.env.META_APP_ID) {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=meta_not_configured`);
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId") || session.user.organizationId;
  const pipelineId = request.nextUrl.searchParams.get("pipelineId") || undefined;

  const state = await createMetaWhatsAppOAuthState(organizationId, pipelineId);
  return NextResponse.redirect(buildMetaWhatsAppAuthUrl(baseUrl, state));
}
