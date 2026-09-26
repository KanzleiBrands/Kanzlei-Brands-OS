import Image from "next/image";
import { Suspense } from "react";
import { cookies } from "next/headers";
import {
  Building2,
  Inbox,
  CalendarClock,
  GraduationCap,
  Package,
  ScrollText,
  LayoutDashboard,
  Megaphone,
  Briefcase,
  UserPlus,
  Users,
  GiftIcon,
} from "lucide-react";
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
import { MainScrollReset } from "./main-scroll-reset";

const navIconClass = "size-4 flex-shrink-0";

function navFor(role: string, campaignKinds: Set<string>) {
  const common = [
    { href: "/dashboard/courses", label: "Schulung", icon: <GraduationCap className={navIconClass} /> },
  ];

  if (role === "AGENCY_ADMIN") {
    return {
      main: [
        { href: "/dashboard/clients", label: "Kunden", icon: <Building2 className={navIconClass} /> },
        { href: "/dashboard/inbox", label: "Posteingang", icon: <Inbox className={navIconClass} /> },
        { href: "/dashboard/tasks", label: "Wiedervorlagen", icon: <CalendarClock className={navIconClass} /> },
        ...common,
      ],
      // Konfigurations-/Kontrollseiten statt Tagesgeschäft - eigene Sektion,
      // damit die Sidebar nicht wie eine einzige flache Liste wirkt.
      admin: [
        { href: "/dashboard/offers", label: "Angebote", icon: <Package className={navIconClass} /> },
        { href: "/dashboard/partner-program", label: "Partnerprogramm", icon: <GiftIcon className={navIconClass} /> },
        { href: "/dashboard/audit-log", label: "Audit-Log", icon: <ScrollText className={navIconClass} /> },
      ],
    };
  }

  // Nicht-Fulfillment-Mitarbeiter (Vertrieb, Backoffice, ...) - nur das
  // interne Portal, kein CRM/Kunden-Zugriff (siehe src/proxy.ts).
  if (role === "AGENCY_STAFF") {
    return {
      main: [
        { href: "/dashboard/intern", label: "Mein Dashboard", icon: <LayoutDashboard className={navIconClass} /> },
        ...common,
      ],
      admin: [],
    };
  }

  return {
    main: [
      { href: "/dashboard/hub", label: "Kunden Hub", icon: <LayoutDashboard className={navIconClass} /> },
      { href: "/dashboard/partner-program", label: "Partnerprogramm", icon: <GiftIcon className={navIconClass} /> },
      ...common,
      { href: "/dashboard/pipelines", label: "Kampagnen", icon: <Megaphone className={navIconClass} /> },
      ...(campaignKinds.has("LEADS")
        ? [{ href: "/dashboard/leads?kind=LEADS", label: "Mandatsanfragen", icon: <Briefcase className={navIconClass} /> }]
        : []),
      ...(campaignKinds.has("APPLICANTS")
        ? [
            { href: "/dashboard/leads?kind=APPLICANTS", label: "Bewerbungen", icon: <UserPlus className={navIconClass} /> },
            { href: "/dashboard/talentpool", label: "Talentpool", icon: <Users className={navIconClass} /> },
          ]
        : []),
      { href: "/dashboard/tasks", label: "Wiedervorlagen", icon: <CalendarClock className={navIconClass} /> },
    ],
    admin: [],
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  let campaignKinds = new Set<string>();
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") {
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

  const { main: mainLinks, admin: adminLinks } = navFor(session.user.role, campaignKinds);

  const internalUser =
    session.user.role === "AGENCY_ADMIN" || session.user.role === "AGENCY_STAFF"
      ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true, hasCashflowAccess: true } })
      : null;
  const department = internalUser?.department ?? null;
  const hasCashflowAccess = internalUser?.hasCashflowAccess ?? false;

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
      <SidebarNav
        role={session.user.role}
        department={department}
        hasCashflowAccess={hasCashflowAccess}
        links={mainLinks}
        adminLinks={adminLinks}
        clients={clients}
        showPortalSwitch={session.user.role === "AGENCY_ADMIN"}
      />
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
      <Suspense fallback={null}>
        <MainScrollReset />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <MobileSidebarShell sidebar={sidebar} />
        <main id="dashboard-main" className="flex-1 md:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
