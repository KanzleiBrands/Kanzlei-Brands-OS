import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { DEPARTMENT_LABELS } from "@/lib/agency-departments";
import { PlusIcon } from "lucide-react";

export default async function MitarbeiterverzeichnisPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const employees = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      department: true,
      location: true,
      position: true,
      employmentEndedAt: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mitarbeiterverzeichnis ({employees.length})</p>
        {session.user.role === "AGENCY_ADMIN" && (
          <Button size="sm" nativeButton={false} render={<Link href="/dashboard/settings?tab=team" />}>
            <PlusIcon className="size-4" />
            Mitarbeiter einladen
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3">Mitarbeiter*in</th>
              <th className="px-4 py-3">Gruppe</th>
              <th className="px-4 py-3">Standort</th>
              <th className="px-4 py-3">Position</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const [firstName, ...rest] = employee.name.trim().split(/\s+/);
              const lastName = rest.at(-1) ?? null;
              const inactive = !!employee.employmentEndedAt;
              return (
                <tr key={employee.id} className="border-b border-foreground/10 last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/intern/personal/${employee.id}`} className="flex items-center gap-3">
                      {employee.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={employee.avatarUrl} alt={employee.name} className="size-8 rounded-full object-cover" />
                      ) : (
                        <div
                          className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: avatarColorFor(employee.name) }}
                        >
                          {initialsOf(firstName ?? null, lastName)}
                        </div>
                      )}
                      <span>
                        <span className="block font-medium">{employee.name}</span>
                        {inactive && <span className="block text-xs text-muted-foreground">Inaktiv</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {employee.department ? <Badge variant="secondary">{DEPARTMENT_LABELS[employee.department]}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.location ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.position ?? "—"}</td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Noch keine Mitarbeiter angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
