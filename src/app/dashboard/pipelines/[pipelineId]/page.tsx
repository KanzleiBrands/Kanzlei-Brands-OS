import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { KanbanBoard } from "./kanban-board";
import { WebhookPanel } from "./webhook-panel";

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
        include: { contacts: { orderBy: { createdAt: "desc" } } },
      },
      webhookEndpoints: {
        include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
    },
  });
  if (!pipeline) notFound();

  const baseUrl = await getBaseUrl();
  const endpoint = pipeline.webhookEndpoints[0];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold">{pipeline.name}</h1>
      <p className="mb-6 text-muted-foreground">
        {pipeline.kind === "LEADS" ? "Leads (CRM)" : "Bewerber (ATS)"}
      </p>
      <div className="mb-6">
        <KanbanBoard pipelineId={pipeline.id} stages={pipeline.stages} />
      </div>
      {endpoint && (
        <WebhookPanel
          endpointId={endpoint.id}
          url={`${baseUrl}/api/webhooks/${endpoint.token}`}
          fieldMapping={endpoint.fieldMapping}
          deliveries={endpoint.deliveries.map((d) => ({
            id: d.id,
            createdAt: d.createdAt.toLocaleString("de-DE"),
            error: d.error,
            contactId: d.contactId,
          }))}
        />
      )}
    </div>
  );
}
