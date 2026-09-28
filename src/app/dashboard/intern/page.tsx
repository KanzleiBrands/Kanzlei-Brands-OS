import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { DepartmentHubView } from "./department-hub-view";
import { ExecutiveDashboard } from "./executive-dashboard";
import { DEPARTMENT_LABELS } from "@/lib/agency-departments";
import { isSuperAdmin } from "@/lib/super-admin";

export default async function InternalPortalPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { departments: true },
  });
  const departments = user?.departments ?? [];

  // Ohne zugewiesene Rolle(n) gibt es keinen eigenen Hub. Der Super-Admin
  // landet auf der Verwaltungsseite (sein eigentliches Zuhause im internen
  // Portal), alle anderen (typischerweise Fulfillment-AGENCY_ADMIN ohne
  // internes Rollen-Tag) zurück ins Kundenportal.
  if (departments.length === 0) {
    if (isSuperAdmin(session.user.email)) redirect("/dashboard/intern/verwaltung");
    redirect("/dashboard");
  }

  // Geschäftsführung bekommt eine echte Zusammenfassung aus allen Bereichen
  // statt des generischen Abteilungs-Hubs (Ansprechpartner/Assets/Schulungen),
  // der für Vertrieb/Backoffice/Fulfillment/Marketing gedacht ist - hat
  // Vorrang vor etwaigen weiteren zugewiesenen Rollen.
  if (departments.includes("EXECUTIVE")) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold">Mein Dashboard – {session.user.name}</h1>
        <p className="mb-6 text-muted-foreground">Geschäftsführung · Kanzlei Brands intern</p>
        <ExecutiveDashboard name={session.user.name} userId={session.user.id} organizationId={session.user.organizationId} />
      </div>
    );
  }

  // Ein Mitarbeiter kann mehrere Rollen gleichzeitig haben (z.B. Fulfillment +
  // internes Marketing) - dann bekommt er hier jeden zugewiesenen Hub
  // untereinander angezeigt.
  const editableResources = isSuperAdmin(session.user.email);
  return (
    <div className="flex flex-col gap-10 p-4 sm:p-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Mein Dashboard – {session.user.name}</h1>
        <p className="text-muted-foreground">
          {departments.map((d) => DEPARTMENT_LABELS[d]).join(" & ")} · Kanzlei Brands intern
        </p>
      </div>
      {departments.map((department) => (
        <div key={department} className="flex flex-col gap-4">
          {departments.length > 1 && <h2 className="text-lg font-semibold">{DEPARTMENT_LABELS[department]}</h2>}
          <DepartmentHubView department={department} userId={session.user.id} editableResources={editableResources} />
        </div>
      ))}
    </div>
  );
}
