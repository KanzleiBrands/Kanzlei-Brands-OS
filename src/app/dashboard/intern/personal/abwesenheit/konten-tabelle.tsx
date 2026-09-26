import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceCell } from "./balance-cell";

export async function KontenTabelle({ organizationId }: { organizationId: string }) {
  const year = new Date().getFullYear();

  const [employees, types, balances] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] }, employmentEndedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.absenceType.findMany({ where: { archivedAt: null, allowanceType: "LIMITED" }, orderBy: { order: "asc" } }),
    prisma.absenceBalance.findMany({ where: { year } }),
  ]);

  const balanceByKey = new Map(balances.map((b) => [`${b.userId}:${b.absenceTypeId}`, b.totalDays]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jahres-Kontingente {year}</CardTitle>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Abwesenheitsart mit Kontingent (limitiert) angelegt - siehe Tab &quot;Abwesenheitsarten&quot;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2">Mitarbeiter*in</th>
                  {types.map((type) => (
                    <th key={type.id} className="px-3 py-2">
                      {type.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-foreground/10 last:border-0">
                    <td className="px-3 py-2 font-medium">{employee.name}</td>
                    {types.map((type) => (
                      <td key={type.id} className="px-3 py-2">
                        <BalanceCell
                          userId={employee.id}
                          absenceTypeId={type.id}
                          year={year}
                          totalDays={balanceByKey.get(`${employee.id}:${type.id}`) ?? type.defaultAnnualDays ?? 0}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={types.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                      Noch keine Mitarbeiter angelegt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
