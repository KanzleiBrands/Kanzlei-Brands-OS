import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { AccountSection } from "./account-section";
import { TeamSection } from "./team-section";
import { MailboxSection } from "./mailbox-section";

type Tab = "account" | "team" | "mailbox";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tab: tabParam, connected, error } = await searchParams;
  const canManageTeam = session.user.role === "CLIENT_ADMIN";
  const canUseMailbox = session.user.role !== "AGENCY_ADMIN";

  const validTabs: Tab[] = ["account", ...(canManageTeam ? (["team"] as const) : []), ...(canUseMailbox ? (["mailbox"] as const) : [])];
  const tab: Tab = validTabs.includes(tabParam as Tab) ? (tabParam as Tab) : "account";

  const organization = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });

  return (
    <div className="p-8">
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
        <TeamSectionData organizationId={session.user.organizationId} currentUserId={session.user.id} />
      )}

      {tab === "mailbox" && canUseMailbox && (
        <MailboxSectionData userId={session.user.id} connected={connected} error={error} />
      )}
    </div>
  );
}

async function TeamSectionData({ organizationId, currentUserId }: { organizationId: string; currentUserId: string }) {
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
