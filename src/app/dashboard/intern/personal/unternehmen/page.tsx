import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyProfileForm } from "./company-profile-form";

export default async function UnternehmensdatenPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true, companyWebsite: true, businessNumber: true, vatId: true, foundedYear: true, mission: true },
  });
  if (!organization) redirect("/dashboard/intern/personal");

  const isHrAdmin = session.user.role === "AGENCY_ADMIN";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unternehmensdaten</CardTitle>
      </CardHeader>
      <CardContent>
        {isHrAdmin ? (
          <CompanyProfileForm organization={organization} />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <Field label="Firmenname" value={organization.name} />
            <Field label="Webseite" value={organization.companyWebsite} isLink />
            <Field label="Betriebsnummer" value={organization.businessNumber} />
            <Field label="Umsatzsteuer-ID" value={organization.vatId} />
            <Field label="Gründungsjahr" value={organization.foundedYear ? String(organization.foundedYear) : null} />
            <Field label="Mission" value={organization.mission} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, isLink = false }: { label: string; value: string | null; isLink?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? (
        isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            {value}
          </a>
        ) : (
          <p className="font-medium">{value}</p>
        )
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}
