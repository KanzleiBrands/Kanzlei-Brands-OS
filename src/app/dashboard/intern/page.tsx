import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { DepartmentHubView } from "./department-hub-view";
import { ExecutiveDashboard } from "./executive-dashboard";
import { DEPARTMENT_LABELS } from "@/lib/agency-departments";

export default async function InternalPortalPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { department: true },
  });

  // AGENCY_ADMIN ohne eigene Abteilung nutzt das interne Portal rein zur
  // Verwaltung (Mitarbeiter/Abteilungen), hat also keinen eigenen Hub.
  if (!user?.department) {
    if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/intern/verwaltung");
    redirect("/dashboard"); // sollte für AGENCY_STAFF nie vorkommen (Pflichtfeld beim Anlegen)
  }

  // Geschäftsführung bekommt eine echte Zusammenfassung aus allen Bereichen
  // statt des generischen Abteilungs-Hubs (Ansprechpartner/Assets/Schulungen),
  // der für Vertrieb/Backoffice/Fulfillment/Marketing gedacht ist.
  if (user.department === "EXECUTIVE") {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold">Mein Dashboard – {session.user.name}</h1>
        <p className="mb-6 text-muted-foreground">Geschäftsführung · Kanzlei Brands intern</p>
        <ExecutiveDashboard name={session.user.name} userId={session.user.id} organizationId={session.user.organizationId} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Mein Dashboard – {session.user.name}</h1>
      <p className="mb-6 text-muted-foreground">{DEPARTMENT_LABELS[user.department]} · Kanzlei Brands intern</p>
      <DepartmentHubView
        department={user.department}
        userId={session.user.id}
        editableResources={session.user.role === "AGENCY_ADMIN"}
      />
    </div>
  );
}
