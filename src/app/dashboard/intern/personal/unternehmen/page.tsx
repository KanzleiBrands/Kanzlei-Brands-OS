import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyProfileForm } from "./company-profile-form";
import { isSuperAdmin } from "@/lib/super-admin";

/** Unternehmensdaten sind Geschäftsführungssache - nur der Super-Admin sieht diesen Tab überhaupt (siehe personal-tabs.tsx). */
export default async function UnternehmensdatenPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.email)) redirect("/dashboard/intern/personal");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true, companyWebsite: true, businessNumber: true, vatId: true, foundedYear: true, mission: true },
  });
  if (!organization) redirect("/dashboard/intern/personal");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unternehmensdaten</CardTitle>
      </CardHeader>
      <CardContent>
        <CompanyProfileForm organization={organization} />
      </CardContent>
    </Card>
  );
}
