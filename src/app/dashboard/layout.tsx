import Image from "next/image";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePipelineIds } from "@/lib/access";
import { getSession, IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { stopImpersonation } from "@/lib/actions/impersonation";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { SettingsLink } from "./settings-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebarShell } from "./mobile-sidebar-shell";
import { ImpersonationBanner } from "./impersonation-banner";

function navFor(role: string, campaignKinds: Set<string>) {
  const common = [{ href: "/dashboard/courses", label: "Schulung" }];

  if (role === "AGENCY_ADMIN") {
    return [
      { href: "/dashboard/clients", label: "Kunden" },
      { href: "/dashboard/tasks", label: "Wiedervorlagen" },
      ...common,
      { href: "/dashboard/offers", label: "Angebote" },
      { href: "/dashboard/audit-log", label: "Audit-Log" },
    ];
  }

  return [
    { href: "/dashboard/hub", label: "Kunden Hub" },
    ...common,
    { href: "/dashboard/pipelines", label: "Kampagnen" },
    ...(campaignKinds.has("LEADS") ? [{ href: "/dashboard/leads?kind=LEADS", label: "Mandatsanfragen" }] : []),
    ...(campaignKinds.has("APPLICANTS")
      ? [{ href: "/dashboard/leads?kind=APPLICANTS", label: "Bewerbungen" }]
      : []),
    { href: "/dashboard/tasks", label: "Wiedervorlagen" },
  ];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  let campaignKinds = new Set<string>();
  if (session.user.role !== "AGENCY_ADMIN") {
    const accessible = await accessiblePipelineIds(session, session.user.organizationId);
    const pipelines = await prisma.pipeline.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
      },
      select: { kind: true },
    });
    campaignKinds = new Set(pipelines.map((p) => p.kind));
  }

  const links = navFor(session.user.role, campaignKinds);

  const clients =
    session.user.role === "AGENCY_ADMIN"
      ? await prisma.organization.findMany({
          where: { type: "CLIENT", parentId: session.user.organizationId, archivedAt: null },
          select: {
            id: true,
            name: true,
            pipelines: { select: { id: true, name: true, active: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { name: "asc" },
        })
      : [];

  const sidebar = (
    <>
      <div className="mb-6 px-2">
        <Image
          src="/brand/logo-on-dark.svg"
          alt="Kanzlei Brands"
          width={140}
          height={56}
          priority
          className="hidden dark:block"
        />
        <Image
          src="/brand/logo-on-light.svg"
          alt="Kanzlei Brands"
          width={140}
          height={56}
          priority
          className="block dark:hidden"
        />
      </div>
      <SidebarNav role={session.user.role} links={links} clients={clients} />
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <ThemeToggle />
        <SettingsLink />
        <p className="truncate px-3 text-sm text-muted-foreground">{session.user.email}</p>
        <form
          action={async () => {
            "use server";
            const store = await cookies();
            store.delete(IMPERSONATION_COOKIE);
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" size="sm" type="submit" className="w-full">
            Abmelden
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:h-dvh md:overflow-hidden">
      {session.impersonation && (
        <ImpersonationBanner
          realUserName={session.impersonation.realUserName}
          viewingAsName={session.user.name}
          onSwitchBack={stopImpersonation}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <MobileSidebarShell sidebar={sidebar} />
        <main className="flex-1 md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
