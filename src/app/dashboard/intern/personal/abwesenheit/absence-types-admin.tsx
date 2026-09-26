import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AbsenceTypeIcon } from "./absence-type-icon";
import { ArchiveTypeButton } from "./archive-type-button";
import { CreateAbsenceTypeForm } from "./create-absence-type-form";

export async function AbsenceTypesAdmin() {
  const types = await prisma.absenceType.findMany({ orderBy: [{ archivedAt: "asc" }, { order: "asc" }] });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Abwesenheitsarten</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {types.map((type) => (
            <div
              key={type.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3 text-sm ${type.archivedAt ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <AbsenceTypeIcon icon={type.icon} color={type.color} />
                <div>
                  <p className="font-medium">{type.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {type.allowanceType === "LIMITED" ? `${type.defaultAnnualDays ?? 0} Tage/Jahr` : "Unbegrenzt"}
                    {type.weeklyCapDays ? ` · bis zu ${type.weeklyCapDays}/Woche` : ""}
                    {type.requiresApproval ? " · genehmigungspflichtig" : " · ohne Genehmigung"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {type.archivedAt ? (
                  <Badge variant="secondary">Archiviert</Badge>
                ) : (
                  <ArchiveTypeButton typeId={type.id} />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Neue Abwesenheitsart</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAbsenceTypeForm />
        </CardContent>
      </Card>
    </div>
  );
}
