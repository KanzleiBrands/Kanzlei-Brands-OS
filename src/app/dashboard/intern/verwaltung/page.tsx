import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DepartmentResourcesCard } from "../department-resources-card";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";
import { isSuperAdmin } from "@/lib/super-admin";

/**
 * Nur noch die Assets/Ressourcen-Links je Abteilung - Mitarbeiter-Zuordnung
 * passiert in Einstellungen -> Mitarbeiter (editable-user-department.tsx),
 * Schulungszuweisung direkt auf dem jeweiligen internen Kurs selbst (Tab
 * "Mitglieder", siehe /dashboard/courses/[courseId]). Beides vorher hier
 * zusätzlich (und nur lesend bzw. verstreut) anzuzeigen hat nur verwirrt.
 */
export default async function InternalPortalAdminPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.email)) redirect("/dashboard/intern");

  const resourceLinks = await prisma.departmentResourceLink.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Internes Portal – Verwaltung</h1>
      <p className="mb-6 text-muted-foreground">
        Assets/Ressourcen je Abteilung pflegen. Mitarbeiter einer Abteilung zuordnen geht über{" "}
        <Link href="/dashboard/settings" className="underline">
          Einstellungen → Mitarbeiter
        </Link>
        , eine Schulung einer Abteilung zuweisen direkt auf der jeweiligen Schulung selbst (Tab &bdquo;Mitglieder&ldquo;
        unter{" "}
        <Link href="/dashboard/intern/schulung/verwaltung" className="underline">
          Schulung verwalten
        </Link>
        ). Wer als Ansprechpartner erscheint, ergibt sich automatisch aus dem{" "}
        <Link href="/dashboard/intern/personal/organigramm" className="underline">
          Organigramm
        </Link>{" "}
        (Vorgesetzte:r laut Manager-Zuordnung im Personal-Bereich).
      </p>

      <div className="flex flex-col gap-6">
        {AGENCY_DEPARTMENTS.map((department) => (
          <Card key={department}>
            <CardHeader>
              <CardTitle>{DEPARTMENT_LABELS[department]}</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentResourcesCard
                department={department}
                links={resourceLinks.filter((l) => l.department === department)}
                editable
                bare
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" size="sm" className="mt-6" nativeButton={false} render={<Link href="/dashboard/clients" />}>
        Zurück zum Kundenportal
      </Button>
    </div>
  );
}
