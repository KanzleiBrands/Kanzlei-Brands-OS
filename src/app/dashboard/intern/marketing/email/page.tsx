import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPipelineForm } from "@/app/dashboard/clients/[orgId]/new-pipeline-form";

export default async function InternalEmailMarketingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;

  const [campaigns, templates] = await Promise.all([
    prisma.pipeline.findMany({
      where: { organizationId, kind: "LEADS" },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stageTemplate.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Neue E-Mail-Kampagne</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Eine Kampagne bündelt eine Kontaktliste (z.B. Interessent:innen, Newsletter-Abonnent:innen) und einen oder
            mehrere E-Mail-Funnels dazu - genau wie das Tool für unsere Kunden, nur für Kanzlei Brands selbst.
          </p>
          <NewPipelineForm organizationId={organizationId} kind="LEADS" templates={templates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unsere Kampagnen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kampagne angelegt.</p>}
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/dashboard/pipelines/${campaign.id}?tab=email-marketing`}
              className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3 text-sm transition-colors hover:border-primary"
            >
              <p className="font-medium">{campaign.name}</p>
              <p className="text-muted-foreground">{campaign._count.contacts} Kontakte</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
