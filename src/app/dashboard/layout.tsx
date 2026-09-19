import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";

function navFor(role: string) {
  const common = [{ href: "/dashboard/courses", label: "Schulung" }];

  if (role === "AGENCY_ADMIN") {
    return [
      { href: "/dashboard/clients", label: "Kunden" },
      ...common,
      { href: "/dashboard/offers", label: "Angebote" },
      { href: "/dashboard/audit-log", label: "Audit-Log" },
    ];
  }

  return [
    { href: "/dashboard/pipelines", label: "Kampagnen" },
    ...common,
    { href: "/dashboard/hub", label: "Angebote" },
  ];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const links = navFor(session.user.role);

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-card p-4">
        <div className="mb-6 px-2">
          <Image src="/brand/logo-on-dark.svg" alt="Kanzlei Brands" width={140} height={56} priority />
        </div>
        <SidebarNav role={session.user.role} links={links} clients={clients} />
        <div className="mt-auto flex flex-col gap-2 px-2 pt-4">
          <Link href="/dashboard/settings" className="rounded px-1 py-1 text-sm hover:underline">
            ⚙ Einstellungen
          </Link>
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" size="sm" type="submit" className="w-full">
              Abmelden
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
