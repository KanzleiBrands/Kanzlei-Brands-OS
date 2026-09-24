import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildLinkedInAuthUrl } from "@/lib/linkedin/client";
import { createLinkedInOAuthState } from "@/lib/linkedin/oauth-state";

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

  if (!process.env.LINKEDIN_CLIENT_ID) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/clients/${organizationId}?tab=content&error=linkedin_not_configured`,
    );
  }

  const state = await createLinkedInOAuthState(organizationId);
  return NextResponse.redirect(buildLinkedInAuthUrl(baseUrl, state));
}
