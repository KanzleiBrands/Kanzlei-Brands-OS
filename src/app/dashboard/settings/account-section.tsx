import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "../account/change-password-form";
import { ChangeEmailForm } from "./change-email-form";

const ROLE_LABELS: Record<string, string> = {
  AGENCY_ADMIN: "Agentur-Admin",
  CLIENT_ADMIN: "Kunden-Admin",
  CLIENT_STAFF: "Mitarbeiter",
};

export function AccountSection({
  name,
  email,
  role,
  organizationName,
}: {
  name: string;
  email: string;
  role: string;
  organizationName?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span> {name}
          </p>
          <p>
            <span className="text-muted-foreground">E-Mail:</span> {email}
          </p>
          <p>
            <span className="text-muted-foreground">Rolle:</span> {ROLE_LABELS[role]}
          </p>
          {organizationName && (
            <p>
              <span className="text-muted-foreground">Organisation:</span> {organizationName}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-Mail ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm currentEmail={email} />
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
