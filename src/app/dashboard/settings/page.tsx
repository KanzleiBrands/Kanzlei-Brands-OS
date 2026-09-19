import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { AccountSection } from "./account-section";
import { TeamSection } from "./team-section";
import { AgencyTeamSection } from "./agency-team-section";
import { MailboxSection } from "./mailbox-section";
import { StageTemplatesSection } from "./stage-templates-section";
import type { EditableStage } from "./stage-list-editor";

type Tab = "account" | "team" | "mailbox" | "templates";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tab: tabParam, connected, error } = await searchParams;
  const isAgency = session.user.role === "AGENCY_ADMIN";
  const canManageTeam = session.user.role === "CLIENT_ADMIN" || isAgency;
  const canUseMailbox = !isAgency;

  const validTabs: Tab[] = [
    "account",
    ...(canManageTeam ? (["team"] as const) : []),
    ...(canUseMailbox ? (["mailbox"] as const) : []),
    ...(isAgency ? (["templates"] as const) : []),
  ];
  const tab: Tab = validTabs.includes(tabParam as Tab) ? (tabParam as Tab) : "account";

  const organization = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-muted-foreground">Account, Team und Postfach verwalten.</p>

      <div className="mb-6 flex gap-1 border-b">
        <Link
          href="/dashboard/settings?tab=account"
          className={`border-b-2 px-3 py-2 text-sm ${tab === "account" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Account
        </Link>
        {canManageTeam && (
          <Link
            href="/dashboard/settings?tab=team"
            className={`border-b-2 px-3 py-2 text-sm ${tab === "team" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Mitarbeiter
          </Link>
        )}
        {canUseMailbox && (
          <Link
            href="/dashboard/settings?tab=mailbox"
            className={`border-b-2 px-3 py-2 text-sm ${tab === "mailbox" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Postfach
          </Link>
        )}
        {isAgency && (
          <Link
            href="/dashboard/settings?tab=templates"
            className={`border-b-2 px-3 py-2 text-sm ${tab === "templates" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Vorlagen
          </Link>
        )}
      </div>

      {tab === "account" && (
        <AccountSection
          name={session.user.name}
          email={session.user.email}
          role={session.user.role}
          organizationName={organization?.name}
        />
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

      {tab === "templates" && isAgency && <StageTemplatesSectionData />}
    </div>
  );
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

  return (
    <TeamSection
      organizationId={organization.id}
      users={organization.users}
      pipelines={organization.pipelines}
      baseUrl={baseUrl}
      currentUserId={currentUserId}
    />
  );
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
  const accounts = await prisma.emailAccount.findMany({ where: { userId } });
  return <MailboxSection accounts={accounts} connected={connected} error={error} />;
}
