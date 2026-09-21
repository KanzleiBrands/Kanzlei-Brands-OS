import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { PipelineView } from "./pipeline-view";
import { WebhookPanel } from "./webhook-panel";
import { MetaConnectionsPanel } from "./meta-connections-panel";
import { PipelineActiveToggle } from "./pipeline-active-toggle";
import { DeletePipelineButton } from "./delete-pipeline-button";
import { EditPipelineNameForm } from "./edit-pipeline-name-form";
import { EditPipelineLocationForm } from "./edit-pipeline-location-form";
import { DuplicateWarningToggle } from "./duplicate-warning-toggle";
import { NotifyNewContactToggle } from "./notify-new-contact-toggle";
import { AutomationsPanel } from "./automations-panel";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";

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
  // Campaign-level settings (name, duplicate warning, active/delete, lead
  // sources) are agency-only; clients only ever see the plain Leads view.
  const canManageSettings = session.user.role === "AGENCY_ADMIN";
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
      metaLeadFormConnections: {
        include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
      automationRules: true,
    },
  });
  if (!pipeline) notFound();

  const baseUrl = await getBaseUrl();
  const siblingPipelines =
    tab === "sources" && canManageSources && pipeline.kind === "APPLICANTS"
      ? await prisma.pipeline.findMany({
          where: { organizationId: pipeline.organizationId, kind: pipeline.kind, id: { not: pipeline.id } },
          select: { id: true, name: true, location: true },
          orderBy: { name: "asc" },
        })
      : [];

  const orgUsers =
    tab === "settings" && canManageSettings
      ? await prisma.user.findMany({
          where: { organizationId: pipeline.organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
        <p className="text-muted-foreground">
          {CAMPAIGN_KIND_LABELS[pipeline.kind] ?? pipeline.kind}
          {pipeline.location && ` · ${pipeline.location}`}
        </p>
      </div>

      {canManageSettings && (
        <div className="mb-6 flex flex-wrap gap-1 border-b">
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=leads`}
            className={`border-b-2 px-3 py-2 text-sm ${tab === "leads" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {pipeline.kind === "APPLICANTS" ? "Bewerbungen" : "Leads"}
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
          <PipelineView
            pipelineId={pipeline.id}
            pipelineKind={pipeline.kind}
            stages={pipeline.stages}
            showDuplicateWarning={pipeline.showDuplicateWarning}
            canDeleteContacts={session.user.role === "AGENCY_ADMIN"}
          />
        </div>
      )}

      {tab === "settings" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm text-muted-foreground">Kampagnenname</p>
            <EditPipelineNameForm pipelineId={pipeline.id} name={pipeline.name} />
          </div>

          {pipeline.kind === "APPLICANTS" && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Standort (z.B. wenn dieselbe Stelle an mehreren Standorten ausgeschrieben ist)
              </p>
              <EditPipelineLocationForm pipelineId={pipeline.id} location={pipeline.location} />
            </div>
          )}

          <DuplicateWarningToggle pipelineId={pipeline.id} enabled={pipeline.showDuplicateWarning} />
          <NotifyNewContactToggle pipelineId={pipeline.id} enabled={pipeline.notifyOnNewContact} />

          <AutomationsPanel
            pipelineId={pipeline.id}
            pipelineKind={pipeline.kind}
            rules={pipeline.automationRules.map((rule) => ({
              trigger: rule.trigger,
              active: rule.active,
              recipientUserId: rule.recipientUserId,
            }))}
            users={orgUsers}
            senderEmail={process.env.RESEND_FROM_EMAIL ?? "automatisierung@kanzlei-brands.de"}
          />

          <div className="flex items-center gap-2">
            <PipelineActiveToggle pipelineId={pipeline.id} active={pipeline.active} />
            <DeletePipelineButton pipelineId={pipeline.id} pipelineName={pipeline.name} />
          </div>
        </div>
      )}

      {tab === "sources" && canManageSources && (
        <div className="flex flex-col gap-6">
          <MetaConnectionsPanel
            pipelineId={pipeline.id}
            metaConfigured={!!process.env.META_APP_ID}
            connections={pipeline.metaLeadFormConnections.map((connection) => ({
              id: connection.id,
              pageName: connection.pageName,
              formName: connection.formName,
              active: connection.active,
              lastError: connection.lastError,
              deliveries: connection.deliveries.map((d) => ({
                id: d.id,
                createdAt: d.createdAt.toLocaleString("de-DE"),
                error: d.error,
                contactId: d.contactId,
              })),
            }))}
          />
          <WebhookPanel
            pipelineId={pipeline.id}
            siblingPipelines={siblingPipelines}
            endpoints={pipeline.webhookEndpoints.map((endpoint) => ({
              id: endpoint.id,
              source: endpoint.source,
              url: `${baseUrl}/api/webhooks/${endpoint.token}`,
              fieldMapping: endpoint.fieldMapping,
              locationRouting: endpoint.locationRouting,
              minCallDurationSeconds: endpoint.minCallDurationSeconds,
              deliveries: endpoint.deliveries.map((d) => ({
                id: d.id,
                createdAt: d.createdAt.toLocaleString("de-DE"),
                error: d.error,
                skippedReason: d.skippedReason,
                contactId: d.contactId,
                rawPayload: d.rawPayload,
              })),
            }))}
          />
        </div>
      )}
    </div>
  );
}
