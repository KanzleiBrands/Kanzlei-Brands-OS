"use client";

import { useTransition } from "react";
import { updateNotificationPreference } from "@/lib/actions/account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationsSection({ notifyOnNewContact }: { notifyOnNewContact: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benachrichtigungen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={notifyOnNewContact}
            disabled={isPending}
            onChange={(e) => {
              const formData = new FormData();
              formData.set("notifyOnNewContact", String(e.target.checked));
              startTransition(() => {
                updateNotificationPreference(formData);
              });
            }}
          />
          Per E-Mail benachrichtigen, wenn ein neuer Lead oder eine neue Bewerbung eingeht
        </label>
        <p className="text-sm text-muted-foreground">
          Gilt nur für Kampagnen, auf die du Zugriff hast, und nur wenn die Agentur die Benachrichtigung für die
          jeweilige Kampagne aktiviert hat (in den Kampagnen-Einstellungen).
        </p>
      </CardContent>
    </Card>
  );
}
