import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildMetaSocialAuthUrl } from "@/lib/meta/graph";
import { createMetaSocialOAuthState } from "@/lib/meta/social-oauth-state";

// Social channel connections are managed per client organization (a Page
// belongs to the client's brand as a whole, not to one campaign) - only
// agency admins configure this, like Lead-Quellen/Postfach.
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();
  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.redirect(`${baseUrl}/dashboard/clients`);
  }

  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.redirect(`${baseUrl}/dashboard/clients/${organizationId}?tab=content&error=no_permission`);
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    return NextResponse.redirect(`${baseUrl}/dashboard/clients`);
  }

  if (!process.env.META_APP_ID) {
    return NextResponse.redirect(`${baseUrl}/dashboard/clients/${organizationId}?tab=content&error=meta_not_configured`);
  }

  const state = await createMetaSocialOAuthState(organizationId);
  return NextResponse.redirect(buildMetaSocialAuthUrl(baseUrl, state));
}
