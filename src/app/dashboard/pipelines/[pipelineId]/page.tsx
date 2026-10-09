import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, isAgencyMarketingStaffFor, AccessDeniedError } from "@/lib/access";
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
import { EmailMarketingTab, type FunnelData } from "./email-marketing-tab";
import { EMAIL_MARKETING_PRODUCT_TAG } from "@/lib/funnels/constants";
import {
  WhatsAppMarketingTab,
  type WhatsAppChannelOption,
  type WhatsAppContactOption,
  type WhatsAppSendRecord,
} from "./whatsapp-marketing-tab";
import { WHATSAPP_MARKETING_PRODUCT_TAG, WHATSAPP_RECRUITING_PRODUCT_TAG } from "@/lib/whatsapp-marketing/constants";
import { listWhatsAppTemplates } from "@/lib/meta/graph";
import { decryptToken } from "@/lib/auth-encryption";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";
import { contactDisplayName } from "@/lib/contact-display";

type Tab = "leads" | "settings" | "sources" | "multiposting" | "email-marketing" | "whatsapp-marketing";

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
          : tabParam === "email-marketing"
            ? "email-marketing"
            : tabParam === "whatsapp-marketing"
              ? "whatsapp-marketing"
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
      organization: { select: { name: true, type: true, bookedProductTags: true } },
    },
  });
  if (!pipeline) notFound();

  const canManageMultiposting = canManageSettings && pipeline.kind === "APPLICANTS";
  if (tab === "multiposting" && !canManageMultiposting) tab = "leads";

  const canViewEmailMarketing = pipeline.kind === "LEADS";
  // Fürs interne Marketing-Center (die Agentur als "Kunde" ihrer selbst):
  // Marketing-Mitarbeiter dürfen das E-Mail-Marketing der eigenen
  // Organisation verwalten, und dort gibt es keine Buchungs-Paywall.
  const isAgencyOwnPipeline = pipeline.organization.type === "AGENCY";
  const isAgencyMarketingStaff = isAgencyOwnPipeline && (await isAgencyMarketingStaffFor(session, pipeline.organizationId));
  const canManageEmailMarketing = canViewEmailMarketing && (canManageSettings || isAgencyMarketingStaff);
  const emailMarketingBooked = isAgencyOwnPipeline || pipeline.organization.bookedProductTags.includes(EMAIL_MARKETING_PRODUCT_TAG);
  if (tab === "email-marketing" && !canViewEmailMarketing) tab = "leads";

  // WhatsApp Marketing (Mandatsakquise-Kampagnen) / WhatsApp Recruiting
  // (Bewerbungs-Kampagnen) - zwei separat buchbare Varianten desselben
  // Reiters, je nach Kampagnen-Art (siehe src/lib/actions/whatsapp-marketing.ts).
  const whatsAppLabel = pipeline.kind === "APPLICANTS" ? "WhatsApp Recruiting" : "WhatsApp Marketing";
  const whatsAppProductTag = pipeline.kind === "APPLICANTS" ? WHATSAPP_RECRUITING_PRODUCT_TAG : WHATSAPP_MARKETING_PRODUCT_TAG;
  const canManageWhatsAppMarketing = canManageSettings || isAgencyMarketingStaff;
  const whatsAppBooked = isAgencyOwnPipeline || pipeline.organization.bookedProductTags.includes(whatsAppProductTag);

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

  let funnelsData: FunnelData[] = [];
  let senderAccounts: { id: string; email: string; userName: string }[] = [];
  if (tab === "email-marketing" && canViewEmailMarketing && (canManageSettings || emailMarketingBooked)) {
    const funnels = await prisma.nurtureFunnel.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { createdAt: "asc" },
      include: {
        steps: { orderBy: { order: "asc" } },
        enrollments: {
          include: { contact: { select: { firstName: true, lastName: true, companyName: true, phone: true } } },
        },
      },
    });

    const stepIds = funnels.flatMap((f) => f.steps.map((s) => s.id));
    const stepStats = stepIds.length
      ? await prisma.funnelStepSend.groupBy({
          by: ["stepId"],
          where: { stepId: { in: stepIds } },
          _count: { _all: true, openedAt: true, clickedAt: true },
        })
      : [];
    const statsByStep = new Map(stepStats.map((s) => [s.stepId, s._count]));

    const allContacts = pipeline.stages.flatMap((s) => s.contacts);

    funnelsData = funnels.map((f) => {
      const enrolledIds = new Set(f.enrollments.map((e) => e.contactId));
      return {
        id: f.id,
        name: f.name,
        active: f.active,
        triggerType: f.triggerType,
        inactivityDays: f.inactivityDays,
        senderAccountId: f.senderAccountId,
        steps: f.steps.map((s) => {
          const stats = statsByStep.get(s.id);
          return {
            id: s.id,
            order: s.order,
            delayDays: s.delayDays,
            subject: s.subject,
            preheader: s.preheader,
            bodyText: s.bodyText,
            ctaLabel: s.ctaLabel,
            ctaUrl: s.ctaUrl,
            sentCount: stats?._all ?? 0,
            openCount: stats?.openedAt ?? 0,
            clickCount: stats?.clickedAt ?? 0,
          };
        }),
        enrollments: f.enrollments.map((e) => ({
          id: e.id,
          contactName: contactDisplayName(e.contact),
          status: e.status,
          currentStepOrder: e.currentStepOrder,
        })),
        enrollableContacts: allContacts
          .filter((c) => !enrolledIds.has(c.id))
          .map((c) => ({ id: c.id, name: contactDisplayName(c), email: c.email })),
      };
    });

    if (canManageEmailMarketing) {
      const accounts = await prisma.emailAccount.findMany({
        where: { user: { organizationId: pipeline.organizationId } },
        include: { user: { select: { name: true } } },
        orderBy: { email: "asc" },
      });
      senderAccounts = accounts.map((a) => ({ id: a.id, email: a.email, userName: a.user.name ?? a.email }));
    }
  }

  let whatsAppChannels: WhatsAppChannelOption[] = [];
  let whatsAppContacts: WhatsAppContactOption[] = [];
  let whatsAppSends: WhatsAppSendRecord[] = [];
  if (tab === "whatsapp-marketing" && (canManageSettings || whatsAppBooked)) {
    const channels = await prisma.whatsAppChannel.findMany({
      where: { organizationId: pipeline.organizationId },
      orderBy: { createdAt: "asc" },
    });
    whatsAppChannels = await Promise.all(
      channels.map(async (channel) => {
        let templates: { name: string; language: string; category: string }[] = [];
        try {
          const all = await listWhatsAppTemplates(channel.businessAccountId, decryptToken(channel.accessTokenEnc));
          templates = all.filter((t) => t.status === "APPROVED");
        } catch {
          templates = [];
        }
        return {
          id: channel.id,
          displayName: channel.displayName,
          displayPhoneNumber: channel.displayPhoneNumber,
          active: channel.active,
          templates,
        };
      }),
    );

    whatsAppContacts = pipeline.stages
      .flatMap((s) => s.contacts)
      .map((c) => ({ id: c.id, name: contactDisplayName(c), phone: c.phone }));

    const sends = await prisma.whatsAppTemplateSend.findMany({
      where: { channel: { organizationId: pipeline.organizationId } },
      include: { sentBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    whatsAppSends = sends.map((s) => ({
      id: s.id,
      templateName: s.templateName,
      recipientPhone: s.recipientPhone,
      status: s.status,
      error: s.error,
      createdAt: s.createdAt.toISOString(),
      sentByName: s.sentBy?.name ?? null,
    }));
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
        <p className="text-muted-foreground">
          {CAMPAIGN_KIND_LABELS[pipeline.kind] ?? pipeline.kind}
          {pipeline.location && ` · ${pipeline.location}`}
        </p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        <Link
          href={`/dashboard/pipelines/${pipeline.id}?tab=leads`}
          className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "leads" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {pipeline.kind === "APPLICANTS" ? "Bewerbungen" : "Leads"}
        </Link>
        {canManageSettings && (
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=settings`}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "settings" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Kampagnen-Einstellungen
          </Link>
        )}
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
        {canViewEmailMarketing && (
          <Link
            href={`/dashboard/pipelines/${pipeline.id}?tab=email-marketing`}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "email-marketing" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            E-Mail Marketing
          </Link>
        )}
        <Link
          href={`/dashboard/pipelines/${pipeline.id}?tab=whatsapp-marketing`}
          className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === "whatsapp-marketing" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {whatsAppLabel}
        </Link>
      </div>

      {tab === "leads" && (
        <div className="mb-6">
          <PipelineView
            pipelineId={pipeline.id}
            pipelineKind={pipeline.kind}
            stages={pipeline.stages}
            showDuplicateWarning={pipeline.showDuplicateWarning}
            canDeleteContacts={session.user.role === "AGENCY_ADMIN"}
            canManageStages={session.user.role === "AGENCY_ADMIN"}
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

      {tab === "email-marketing" && canViewEmailMarketing && (
        <EmailMarketingTab
          pipelineId={pipeline.id}
          organizationId={pipeline.organizationId}
          isAgency={canManageSettings}
          canManage={canManageEmailMarketing}
          booked={emailMarketingBooked}
          funnels={funnelsData}
          senderAccounts={senderAccounts}
          isOwnOrganization={isAgencyOwnPipeline}
        />
      )}

      {tab === "whatsapp-marketing" && (
        <WhatsAppMarketingTab
          pipelineId={pipeline.id}
          organizationId={pipeline.organizationId}
          label={whatsAppLabel}
          isAgency={canManageSettings}
          canManage={canManageWhatsAppMarketing}
          booked={whatsAppBooked}
          channels={whatsAppChannels}
          contacts={whatsAppContacts}
          recentSends={whatsAppSends}
          isOwnOrganization={isAgencyOwnPipeline}
        />
      )}
    </div>
  );
}
