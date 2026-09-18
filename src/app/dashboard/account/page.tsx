import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

const ROLE_LABELS: Record<string, string> = {
  AGENCY_ADMIN: "Agentur-Admin",
  CLIENT_ADMIN: "Kunden-Admin",
  CLIENT_STAFF: "Mitarbeiter",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Mein Account</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span> {session.user.name}
          </p>
          <p>
            <span className="text-muted-foreground">E-Mail:</span> {session.user.email}
          </p>
          <p>
            <span className="text-muted-foreground">Rolle:</span> {ROLE_LABELS[session.user.role]}
          </p>
          <p>
            <span className="text-muted-foreground">Organisation:</span> {organization?.name}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
