import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { buildMetaAuthUrl } from "@/lib/meta/graph";
import { createMetaOAuthState } from "@/lib/meta/oauth-state";

// Meta connections are managed exactly like Lead-Quellen (Webhooks): only
// agency admins configure where a campaign's leads come from - a client
// never sees or triggers this route.
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const baseUrl = await getBaseUrl();
  const pipelineId = request.nextUrl.searchParams.get("pipelineId");
  if (!pipelineId) {
    return NextResponse.redirect(`${baseUrl}/dashboard/pipelines`);
  }

  if (session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.redirect(`${baseUrl}/dashboard/pipelines/${pipelineId}?error=no_permission`);
  }

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.redirect(`${baseUrl}/dashboard/pipelines`);
    }
    throw error;
  }

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) {
    return NextResponse.redirect(`${baseUrl}/dashboard/pipelines`);
  }

  if (!process.env.META_APP_ID) {
    return NextResponse.redirect(`${baseUrl}/dashboard/pipelines/${pipelineId}?tab=sources&error=meta_not_configured`);
  }

  const state = await createMetaOAuthState(pipelineId);
  return NextResponse.redirect(buildMetaAuthUrl(baseUrl, state));
}
