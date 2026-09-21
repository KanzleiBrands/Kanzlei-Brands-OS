"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateNotificationPreference } from "@/lib/actions/account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function NotificationsSection({ notifyOnNewContact }: { notifyOnNewContact: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benachrichtigungen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            defaultChecked={notifyOnNewContact}
            disabled={isPending}
            onCheckedChange={(checked) => {
              const formData = new FormData();
              formData.set("notifyOnNewContact", String(checked));
              startTransition(async () => {
                try {
                  await updateNotificationPreference(formData);
                  toast.success("Gespeichert.");
                } catch {
                  toast.error("Konnte nicht gespeichert werden.");
                }
              });
            }}
          />
          Per E-Mail benachrichtigen, wenn ein neuer Lead oder eine neue Bewerbung eingeht
        </label>
        <p className="text-sm text-muted-foreground">
          Gilt nur für Kampagnen, auf die du Zugriff hast, und nur wenn Kanzlei Brands die Benachrichtigung für die
          jeweilige Kampagne aktiviert hat (in den Kampagnen-Einstellungen).
        </p>
      </CardContent>
    </Card>
  );
}
