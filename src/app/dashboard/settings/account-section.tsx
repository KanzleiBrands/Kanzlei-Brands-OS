import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "../account/change-password-form";
import { ChangeEmailForm } from "./change-email-form";
import { ContactInfoForm } from "./contact-info-form";
import { AvatarUploadForm } from "./avatar-upload-form";
import { BackofficeContactForm } from "./backoffice-contact-form";

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
  phone,
  calendlyUrl,
  avatarUrl,
  backofficeContactId,
  agencyUsers,
}: {
  name: string;
  email: string;
  role: string;
  organizationName?: string;
  phone: string | null;
  calendlyUrl: string | null;
  avatarUrl: string | null;
  backofficeContactId: string | null;
  agencyUsers: { id: string; name: string }[];
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

      {role === "AGENCY_ADMIN" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profilbild</CardTitle>
            </CardHeader>
            <CardContent>
              <AvatarUploadForm name={name} avatarUrl={avatarUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontaktdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactInfoForm phone={phone} calendlyUrl={calendlyUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buchhaltung / Backoffice-Ansprechpartner</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Portalweit einheitlich für alle Kunden - es gibt nur eine Buchhaltung. Wird im Kunden-Hub jedes Kunden
                für Fragen zu Rechnungen/Vertragswesen angezeigt. Telefon/Calendly pflegt diese Person selbst hier
                unter Profilbild/Kontaktdaten.
              </p>
              <BackofficeContactForm backofficeContactId={backofficeContactId} agencyUsers={agencyUsers} />
            </CardContent>
          </Card>
        </>
      )}

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
