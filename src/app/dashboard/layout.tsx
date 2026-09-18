import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

function navFor(role: string) {
  const common = [
    { href: "/dashboard/courses", label: "Schulung" },
  ];

  if (role === "AGENCY_ADMIN") {
    return [
      { href: "/dashboard/clients", label: "Kunden" },
      ...common,
      { href: "/dashboard/audit-log", label: "Audit-Log" },
    ];
  }

  return [
    { href: "/dashboard/pipelines", label: "Pipelines" },
    ...(role === "CLIENT_ADMIN" ? [{ href: "/dashboard/team", label: "Mitarbeiter" }] : []),
    { href: "/dashboard/mailbox", label: "Postfach" },
    ...common,
    { href: "/dashboard/hub", label: "Kunden-Hub" },
    ...(role === "CLIENT_ADMIN" ? [{ href: "/dashboard/audit-log", label: "Audit-Log" }] : []),
  ];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const links = navFor(session.user.role);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-card p-4">
        <div className="mb-6 px-2">
          <Image src="/brand/logo-on-dark.svg" alt="Kanzlei Brands" width={140} height={56} priority />
        </div>
        <nav className="flex flex-col gap-1">
          <Link href="/dashboard" className="rounded px-3 py-2 text-sm hover:bg-muted">
            Übersicht
          </Link>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded px-3 py-2 text-sm hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2 pt-4">
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
