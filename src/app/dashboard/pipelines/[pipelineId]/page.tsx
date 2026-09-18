import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { PipelineView } from "./pipeline-view";
import { WebhookPanel } from "./webhook-panel";
import { PipelineActiveToggle } from "./pipeline-active-toggle";
import { DeletePipelineButton } from "./delete-pipeline-button";

type Tab = "leads" | "settings" | "sources";

export default async function PipelineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ pipelineId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const { tab: tabParam } = await searchParams;
  const canManageSettings = session.user.role !== "CLIENT_STAFF";
  const canManageSources = session.user.role === "AGENCY_ADMIN";
  const tab: Tab =
    tabParam === "settings" && canManageSettings
      ? "settings"
      : tabParam === "sources" && canManageSources
        ? "sources"
        : "leads";

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
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
        <p className="text-muted-foreground">{pipeline.kind === "LEADS" ? "Leads (CRM)" : "Bewerber (ATS)"}</p>
      </div>

      {canManageSettings && (
        <div className="mb-6 flex gap-1 border-b">
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=leads`}
            className={`border-b-2 px-3 py-2 text-sm ${tab === "leads" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Leads
          </Link>
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=settings`}
            className={`border-b-2 px-3 py-2 text-sm ${tab === "settings" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Kampagnen-Einstellungen
          </Link>
          {canManageSources && (
            <Link
              href={`/dashboard/pipelines/${pipeline.id}?tab=sources`}
              className={`border-b-2 px-3 py-2 text-sm ${tab === "sources" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Lead-Quellen
            </Link>
          )}
        </div>
      )}

      {tab === "leads" && (
        <div className="mb-6">
          <PipelineView pipelineId={pipeline.id} stages={pipeline.stages} />
        </div>
      )}

      {tab === "settings" && (
        <div className="flex items-center gap-2">
          <PipelineActiveToggle pipelineId={pipeline.id} active={pipeline.active} />
          <DeletePipelineButton pipelineId={pipeline.id} pipelineName={pipeline.name} />
        </div>
      )}

      {tab === "sources" && canManageSources && (
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
      )}
    </div>
  );
}
