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
import { FinalStageSelector } from "./final-stage-selector";
import { JobPostingForm } from "./job-posting-form";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";

type Tab = "leads" | "settings" | "sources" | "multiposting";

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
  let tab: Tab =
    tabParam === "settings" && canManageSettings
      ? "settings"
      : tabParam === "sources" && canManageSources
        ? "sources"
        : tabParam === "multiposting" && canManageSettings
          ? "multiposting"
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
      jobPosting: true,
      organization: { select: { name: true } },
    },
  });
  if (!pipeline) notFound();

  const canManageMultiposting = canManageSettings && pipeline.kind === "APPLICANTS";
  if (tab === "multiposting" && !canManageMultiposting) tab = "leads";

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
        <div className="mb-6 flex gap-1 overflow-x-auto border-b">
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=leads`}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "leads" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {pipeline.kind === "APPLICANTS" ? "Bewerbungen" : "Leads"}
          </Link>
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=settings`}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "settings" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Kampagnen-Einstellungen
          </Link>
          {canManageSources && (
            <Link
              href={`/dashboard/pipelines/${pipeline.id}?tab=sources`}
              className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "sources" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Lead-Quellen
            </Link>
          )}
          {canManageMultiposting && (
            <Link
              href={`/dashboard/pipelines/${pipeline.id}?tab=multiposting`}
              className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "multiposting" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Stellenportale
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

          <FinalStageSelector
            pipelineId={pipeline.id}
            stages={[...pipeline.stages].sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, name: s.name }))}
            finalStageId={pipeline.stages.find((s) => s.isFinal)?.id}
          />

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

      {tab === "multiposting" && canManageMultiposting && (
        <JobPostingForm
          pipelineId={pipeline.id}
          pipelineName={pipeline.name}
          organizationName={pipeline.organization.name}
          publicUrl={`${baseUrl}/jobs/${pipeline.id}`}
          jobPosting={
            pipeline.jobPosting
              ? {
                  heroImageUrl: pipeline.jobPosting.heroImageUrl,
                  galleryUrls: pipeline.jobPosting.galleryUrls,
                  aboutUs: pipeline.jobPosting.aboutUs,
                  tasks: pipeline.jobPosting.tasks,
                  profile: pipeline.jobPosting.profile,
                  benefitsList: pipeline.jobPosting.benefitsList,
                  contactName: pipeline.jobPosting.contactName,
                  contactEmail: pipeline.jobPosting.contactEmail,
                  applicationUrl: pipeline.jobPosting.applicationUrl,
                  targetPortals: pipeline.jobPosting.targetPortals,
                  employerName: pipeline.jobPosting.employerName,
                  employerLogoUrl: pipeline.jobPosting.employerLogoUrl,
                  employerWebsite: pipeline.jobPosting.employerWebsite,
                  street: pipeline.jobPosting.street,
                  postalCode: pipeline.jobPosting.postalCode,
                  city: pipeline.jobPosting.city,
                  country: pipeline.jobPosting.country,
                  employmentType: pipeline.jobPosting.employmentType,
                  validThrough: pipeline.jobPosting.validThrough
                    ? pipeline.jobPosting.validThrough.toISOString().slice(0, 10)
                    : null,
                  isPublished: pipeline.jobPosting.isPublished,
                }
              : null
          }
        />
      )}
    </div>
  );
}
