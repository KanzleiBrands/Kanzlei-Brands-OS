import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { DEPARTMENT_LABELS } from "@/lib/agency-departments";

type EmployeeNode = {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
  managerId: string | null;
};

function OrgNode({ node, byManager }: { node: EmployeeNode; byManager: Map<string, EmployeeNode[]> }) {
  const [firstName, ...rest] = node.name.trim().split(/\s+/);
  const lastName = rest.at(-1) ?? null;
  const reports = byManager.get(node.id) ?? [];

  return (
    <div className="flex flex-col items-center">
      <Link
        href={`/dashboard/intern/personal/${node.id}`}
        className="flex w-56 flex-col items-center gap-1.5 rounded-xl bg-card p-3 text-center ring-1 ring-foreground/10 transition-colors hover:ring-primary"
      >
        {node.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.avatarUrl} alt={node.name} className="size-12 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-12 items-center justify-center rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: avatarColorFor(node.name) }}
          >
            {initialsOf(firstName ?? null, lastName)}
          </div>
        )}
        <span className="font-medium">{node.name}</span>
        {node.position && <span className="text-xs text-muted-foreground">{node.position}</span>}
        {node.department && (
          <Badge variant="secondary" className="text-[10px]">
            {DEPARTMENT_LABELS[node.department as keyof typeof DEPARTMENT_LABELS]}
          </Badge>
        )}
        {reports.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {reports.length} direkt Berichtende
          </span>
        )}
      </Link>

      {reports.length > 0 && (
        <>
          <div className="h-6 w-px bg-foreground/15" />
          <div className="flex flex-wrap justify-center gap-6">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-col items-center">
                <div className="h-6 w-px bg-foreground/15" />
                <OrgNode node={report} byManager={byManager} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default async function OrganigrammPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const employees = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] },
      employmentEndedAt: null,
    },
    select: { id: true, name: true, position: true, department: true, avatarUrl: true, managerId: true },
    orderBy: { name: "asc" },
  });

  const byManager = new Map<string, EmployeeNode[]>();
  for (const employee of employees) {
    if (!employee.managerId) continue;
    const list = byManager.get(employee.managerId) ?? [];
    list.push(employee);
    byManager.set(employee.managerId, list);
  }

  const roots = employees.filter((e) => !e.managerId || !employees.some((other) => other.id === e.managerId));

  return (
    <div className="flex flex-col items-center gap-10 overflow-x-auto pb-8">
      {roots.map((root) => (
        <OrgNode key={root.id} node={root} byManager={byManager} />
      ))}
      {roots.length === 0 && <p className="text-muted-foreground">Noch keine Mitarbeiter angelegt.</p>}
    </div>
  );
}
