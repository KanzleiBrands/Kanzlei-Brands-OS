import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { PipelineView } from "./pipeline-view";
import { WebhookPanel } from "./webhook-panel";
import { PipelineActiveToggle } from "./pipeline-active-toggle";

export default async function PipelineDetailPage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          contacts: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { activities: true } } },
          },
        },
      },
      webhookEndpoints: {
        include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
    },
  });
  if (!pipeline) notFound();

  const baseUrl = await getBaseUrl();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
          <p className="text-muted-foreground">{pipeline.kind === "LEADS" ? "Leads (CRM)" : "Bewerber (ATS)"}</p>
        </div>
        {session.user.role !== "CLIENT_STAFF" && (
          <PipelineActiveToggle pipelineId={pipeline.id} active={pipeline.active} />
        )}
      </div>
      <div className="mb-6">
        <PipelineView pipelineId={pipeline.id} stages={pipeline.stages} />
      </div>
      <WebhookPanel
        pipelineId={pipeline.id}
        endpoints={pipeline.webhookEndpoints.map((endpoint) => ({
          id: endpoint.id,
          source: endpoint.source,
          url: `${baseUrl}/api/webhooks/${endpoint.token}`,
          fieldMapping: endpoint.fieldMapping,
          deliveries: endpoint.deliveries.map((d) => ({
            id: d.id,
            createdAt: d.createdAt.toLocaleString("de-DE"),
            error: d.error,
            contactId: d.contactId,
          })),
        }))}
      />
    </div>
  );
}
