import { CalendarIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initialsOf, avatarColorFor } from "@/lib/avatar";

const OFFICE_PHONE = "+4940238359780";
const OFFICE_PHONE_LABEL = "040 238 359 780";

export function ContactCard({
  title,
  description,
  contact,
  teamEmail,
}: {
  title: string;
  description: string;
  contact: { name: string; phone: string | null; calendlyUrl: string | null; avatarUrl: string | null } | null;
  teamEmail: string;
}) {
  const [firstName, ...rest] = contact?.name.trim().split(/\s+/) ?? [];
  const lastName = rest.at(-1) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{description}</p>

        {contact ? (
          <div className="flex items-center gap-3">
            {contact.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contact.avatarUrl} alt={contact.name} className="size-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex size-10 items-center justify-center rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: avatarColorFor(contact.name) }}
              >
                {initialsOf(firstName ?? null, lastName)}
              </div>
            )}
            <p className="font-medium">{contact.name}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch nicht zugewiesen.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {contact?.phone && (
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${contact.phone}`} />}>
              <PhoneIcon className="size-3.5" />
              Anrufen
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={`mailto:${teamEmail}`} />}>
            <MailIcon className="size-3.5" />
            E-Mail
          </Button>
          {contact?.calendlyUrl && (
            <Button
              size="sm"
              nativeButton={false}
              render={<a href={contact.calendlyUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <CalendarIcon className="size-3.5" />
              Termin buchen
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${OFFICE_PHONE}`} />}>
            <PhoneIcon className="size-3.5" />
            Zentrale: {OFFICE_PHONE_LABEL}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
