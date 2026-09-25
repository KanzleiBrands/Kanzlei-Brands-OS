import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { getClientReadiness } from "@/lib/client-readiness";
import { AccountSection } from "./account-section";
import { ClientHubSettingsSection } from "./client-hub-settings-section";
import { TeamSection } from "./team-section";
import { AgencyTeamSection } from "./agency-team-section";
import { MailboxSection } from "./mailbox-section";
import { StageTemplatesSection } from "./stage-templates-section";
import { MessageTemplatesSection } from "./message-templates-section";
import { PrivacySection } from "./privacy-section";
import { NotificationsSection } from "./notifications-section";
import { EmailCenterSection, type SystemEmailTemplateData } from "./email-center-section";
import { SYSTEM_EMAIL_DEFAULTS, SYSTEM_EMAIL_TYPES } from "@/lib/email/system-email-defaults";
import { PageLayoutBuilder } from "./page-layout-builder";
import { getPageLayout } from "@/lib/page-layout";
import type { EditableStage } from "./stage-list-editor";

type Tab =
  | "account"
  | "notifications"
  | "team"
  | "mailbox"
  | "snippets"
  | "templates"
  | "hubsettings"
  | "emailcenter"
  | "pagebuilder"
  | "privacy";

const TAB_LABELS: Record<Tab, string> = {
  account: "Account",
  notifications: "Benachrichtigungen",
  team: "Mitarbeiter",
  mailbox: "Postfach",
  snippets: "Textbausteine",
  templates: "Statusvorlagen",
  hubsettings: "Einstellung Kundenhub",
  emailcenter: "E-Mail-Center",
  pagebuilder: "Seiten-Layout",
  privacy: "Datenschutz",
};

function tabLinkClass(active: boolean) {
  return `border-b-2 px-2.5 py-2 text-sm ${active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { tab: tabParam, connected, error } = await searchParams;
  const isAgency = session.user.role === "AGENCY_ADMIN";
  const canManageTeam = session.user.role === "CLIENT_ADMIN" || isAgency;
  // Every user can connect their own mailbox: clients for their own use, and
  // agency staff so the team-wide /dashboard/inbox has something to sync.
  const canUseMailbox = true;

  const validTabs: Tab[] = [
    "account",
    "notifications",
    ...(canManageTeam ? (["team"] as const) : []),
    ...(canUseMailbox ? (["mailbox"] as const) : []),
    "snippets",
    ...(isAgency ? (["templates", "hubsettings", "emailcenter", "pagebuilder"] as const) : []),
    ...(!isAgency ? (["privacy"] as const) : []),
  ];
  const tab: Tab = validTabs.includes(tabParam as Tab) ? (tabParam as Tab) : "account";

  const tabClusters: { label: string; tabs: Tab[] }[] = [
    { label: "Account", tabs: ["account", "notifications", ...(!isAgency ? (["privacy"] as const) : [])] as Tab[] },
    {
      label: "Team & Postfach",
      tabs: [
        ...(canManageTeam ? (["team"] as const) : []),
        ...(canUseMailbox ? (["mailbox"] as const) : []),
      ] as Tab[],
    },
    { label: "Vorlagen", tabs: ["snippets", ...(isAgency ? (["templates"] as const) : [])] as Tab[] },
    ...(isAgency
      ? [{ label: "Plattform", tabs: ["hubsettings", "emailcenter", "pagebuilder"] as Tab[] }]
      : []),
  ].filter((cluster) => cluster.tabs.length > 0);

  const organization = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifyOnNewContact: true, phone: true, calendlyUrl: true, avatarUrl: true },
  });
  const agencyUsers = isAgency
    ? await prisma.user.findMany({
        where: { role: "AGENCY_ADMIN", organizationId: session.user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-muted-foreground">Account, Team und Postfach verwalten.</p>

      <div className="mb-6 flex flex-wrap items-end gap-x-5 gap-y-3 border-b">
        {tabClusters.map((cluster, index) => (
          <div key={cluster.label} className="flex items-end gap-x-5">
            {index > 0 && <span aria-hidden="true" className="mb-2 h-5 w-px bg-border" />}
            <div className="flex flex-col gap-1">
              <span className="px-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {cluster.label}
              </span>
              <div className="flex gap-1">
                {cluster.tabs.map((t) => (
                  <Link key={t} href={`/dashboard/settings?tab=${t}`} className={tabLinkClass(tab === t)}>
                    {TAB_LABELS[t]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tab === "account" && (
        <AccountSection
          name={session.user.name}
          email={session.user.email}
          role={session.user.role}
          organizationName={organization?.name}
          avatarUrl={currentUser?.avatarUrl ?? null}
        />
      )}

      {tab === "notifications" && (
        <NotificationsSection notifyOnNewContact={currentUser?.notifyOnNewContact ?? true} />
      )}

      {tab === "team" && canManageTeam && (
        <TeamSectionData
          organizationId={session.user.organizationId}
          currentUserId={session.user.id}
          isAgency={isAgency}
        />
      )}

      {tab === "mailbox" && canUseMailbox && (
        <MailboxSectionData userId={session.user.id} connected={connected} error={error} />
      )}

      {tab === "snippets" && <MessageTemplatesSectionData organizationId={session.user.organizationId} />}

      {tab === "templates" && isAgency && <StageTemplatesSectionData />}

      {tab === "hubsettings" && isAgency && (
        <ClientHubSettingsSection
          phone={currentUser?.phone ?? null}
          calendlyUrl={currentUser?.calendlyUrl ?? null}
          backofficeContactId={organization?.backofficeContactId ?? null}
          agencyUsers={agencyUsers}
        />
      )}

      {tab === "emailcenter" && isAgency && <EmailCenterSectionData baseUrl={await getBaseUrl()} />}

      {tab === "pagebuilder" && isAgency && <PageLayoutBuilderData />}

      {tab === "privacy" && !isAgency && (
        <PrivacySection
          applicantDataRetentionMonths={organization?.applicantDataRetentionMonths ?? null}
          leadDataRetentionMonths={organization?.leadDataRetentionMonths ?? null}
        />
      )}
    </div>
  );
}

async function MessageTemplatesSectionData({ organizationId }: { organizationId: string }) {
  const templates = await prisma.messageTemplate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return <MessageTemplatesSection templates={templates} />;
}

async function StageTemplatesSectionData() {
  const templates = await prisma.stageTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <StageTemplatesSection
      templates={templates.map((t) => ({ id: t.id, name: t.name, stages: t.stages as unknown as EditableStage[] }))}
    />
  );
}

async function TeamSectionData({
  organizationId,
  currentUserId,
  isAgency,
}: {
  organizationId: string;
  currentUserId: string;
  isAgency: boolean;
}) {
  const [organization, baseUrl] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: { orderBy: { createdAt: "asc" }, include: { pipelineAccess: true } },
        pipelines: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
      },
    }),
    getBaseUrl(),
  ]);
  if (!organization) return null;

  if (isAgency) {
    return (
      <AgencyTeamSection
        organizationId={organization.id}
        users={organization.users}
        baseUrl={baseUrl}
        currentUserId={currentUserId}
      />
    );
  }

  const inviteReadiness = await getClientReadiness(organization.id);

  return (
    <TeamSection
      organizationId={organization.id}
      users={organization.users}
      pipelines={organization.pipelines}
      baseUrl={baseUrl}
      currentUserId={currentUserId}
      inviteReadiness={inviteReadiness}
    />
  );
}

async function EmailCenterSectionData({ baseUrl }: { baseUrl: string }) {
  const rows = await prisma.systemEmailTemplate.findMany();
  const rowByType = new Map(rows.map((r) => [r.type, r]));

  const templates: SystemEmailTemplateData[] = SYSTEM_EMAIL_TYPES.map((type) => {
    const fallback = SYSTEM_EMAIL_DEFAULTS[type];
    const row = rowByType.get(type);
    return {
      type,
      label: fallback.label,
      description: fallback.description,
      placeholders: fallback.placeholders,
      subject: row?.subject ?? fallback.subject,
      heading: row?.heading ?? fallback.heading,
      body: row?.body ?? fallback.body,
      ctaLabel: row?.ctaLabel ?? fallback.ctaLabel,
      footerNote: row?.footerNote ?? fallback.footerNote,
    };
  });

  return <EmailCenterSection templates={templates} baseUrl={baseUrl} />;
}

async function PageLayoutBuilderData() {
  const [overview, hub] = await Promise.all([getPageLayout("OVERVIEW"), getPageLayout("HUB")]);
  return <PageLayoutBuilder overview={overview} hub={hub} />;
}

async function MailboxSectionData({
  userId,
  connected,
  error,
}: {
  userId: string;
  connected?: string;
  error?: string;
}) {
  const [accounts, user] = await Promise.all([
    prisma.emailAccount.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { signature: true } }),
  ]);
  return <MailboxSection accounts={accounts} connected={connected} error={error} signature={user?.signature ?? null} />;
}
