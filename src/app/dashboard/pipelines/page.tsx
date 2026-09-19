import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePipelineIds } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";
import { CampaignRequestCard } from "./campaign-request-card";

export default async function PipelinesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const accessible = await accessiblePipelineIds(session, session.user.organizationId);
  const [pipelines, organization] = await Promise.all([
    prisma.pipeline.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
      },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { leadsQuota: true, applicantsQuota: true, leadsFormUrl: true, applicantsFormUrl: true },
    }),
  ]);

  // Usage counts every pipeline of that kind, not just the ones this staff
  // member has access to - the booked quota is a whole-account limit.
  const allOrgPipelines = await prisma.pipeline.findMany({
    where: { organizationId: session.user.organizationId },
    select: { kind: true },
  });
  const leadsUsed = allOrgPipelines.filter((p) => p.kind === "LEADS").length;
  const applicantsUsed = allOrgPipelines.filter((p) => p.kind === "APPLICANTS").length;
  const canRequest = session.user.role === "CLIENT_ADMIN";

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Kampagnen</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pipelines.map((pipeline) => (
          <Link key={pipeline.id} href={`/dashboard/pipelines/${pipeline.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{pipeline.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {CAMPAIGN_KIND_LABELS[pipeline.kind] ?? pipeline.kind}
                  {pipeline.location && ` · ${pipeline.location}`} · {pipeline._count.contacts} Kontakte
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {pipelines.length === 0 && (
          <p className="text-muted-foreground">Dir wurde noch keine Kampagne zugewiesen.</p>
        )}

        {organization && (
          <>
            <CampaignRequestCard
              organizationId={session.user.organizationId}
              kind="APPLICANTS"
              used={applicantsUsed}
              quota={organization.applicantsQuota}
              formUrl={organization.applicantsFormUrl}
              canRequest={canRequest}
            />
            <CampaignRequestCard
              organizationId={session.user.organizationId}
              kind="LEADS"
              used={leadsUsed}
              quota={organization.leadsQuota}
              formUrl={organization.leadsFormUrl}
              canRequest={canRequest}
            />
          </>
        )}
      </div>
    </div>
  );
}
