import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildMetaWhatsAppAuthUrl } from "@/lib/meta/graph";
import { createMetaWhatsAppOAuthState } from "@/lib/meta/whatsapp-oauth-state";

// WhatsApp ist ausschließlich fürs interne Marketing-Center (die Agentur
// verbindet ihre eigene WhatsApp-Business-Nummer) - anders als beim
// Social-Media-Connect gibt es hier keinen "für welchen Kunden"-Parameter,
// nur Agentur-Admins dürfen das einrichten.
export async function GET() {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();

  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=no_permission`);
  }

  if (!process.env.META_APP_ID) {
    return NextResponse.redirect(`${baseUrl}/dashboard/intern/marketing/whatsapp?error=meta_not_configured`);
  }

  const state = await createMetaWhatsAppOAuthState(session.user.organizationId);
  return NextResponse.redirect(buildMetaWhatsAppAuthUrl(baseUrl, state));
}
