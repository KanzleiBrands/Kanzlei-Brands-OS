import { CalendarIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ContactCard({
  title,
  description,
  contact,
  teamEmail,
}: {
  title: string;
  description: string;
  contact: { name: string; phone: string | null; calendlyUrl: string | null } | null;
  teamEmail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{description}</p>

        {contact ? (
          <>
            <p className="font-medium">{contact.name}</p>
            <div className="flex flex-wrap gap-2">
              {contact.phone && (
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${contact.phone}`} />}>
                  <PhoneIcon className="size-3.5" />
                  Anrufen
                </Button>
              )}
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={`mailto:${teamEmail}`} />}>
                <MailIcon className="size-3.5" />
                E-Mail
              </Button>
              {contact.calendlyUrl && (
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<a href={contact.calendlyUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  <CalendarIcon className="size-3.5" />
                  Termin buchen
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Noch nicht zugewiesen.</p>
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={`mailto:${teamEmail}`} />}>
              <MailIcon className="size-3.5" />
              E-Mail
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
