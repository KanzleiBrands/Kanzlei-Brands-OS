import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactInfoForm } from "./contact-info-form";
import { BackofficeContactForm } from "./backoffice-contact-form";

export function ClientHubSettingsSection({
  phone,
  calendlyUrl,
  backofficeContactId,
  agencyUsers,
}: {
  phone: string | null;
  calendlyUrl: string | null;
  backofficeContactId: string | null;
  agencyUsers: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
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
            Portalweit einheitlich für alle Kunden - es gibt nur eine Buchhaltung. Wird im Kunden-Hub jedes Kunden für
            Fragen zu Rechnungen/Vertragswesen angezeigt. Telefon/Calendly pflegt diese Person selbst hier unter
            Profilbild/Kontaktdaten.
          </p>
          <BackofficeContactForm backofficeContactId={backofficeContactId} agencyUsers={agencyUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
