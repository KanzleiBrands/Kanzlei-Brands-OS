"use client";

import { useActionState, useState } from "react";
import { updateFieldMapping } from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Delivery = {
  id: string;
  createdAt: string;
  error: string | null;
  contactId: string | null;
};

export function WebhookPanel({
  endpointId,
  url,
  fieldMapping,
  deliveries,
}: {
  endpointId: string;
  url: string;
  fieldMapping: unknown;
  deliveries: Delivery[];
}) {
  const [error, formAction, isPending] = useActionState(updateFieldMapping, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead-Eingang (Webhook)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            Diese URL bei OnePage, Perspektive oder Zapier als Webhook-Ziel eintragen (POST, JSON-Body):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{url}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Kopiert!" : "Kopieren"}
            </Button>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="endpointId" value={endpointId} />
          <label className="text-sm font-medium">
            Feld-Mapping (optional, JSON: Contact-Feld → Pfad im Payload)
          </label>
          <Textarea
            name="fieldMapping"
            placeholder='{"email": "data.email", "firstName": "data.first_name"}'
            defaultValue={fieldMapping ? JSON.stringify(fieldMapping, null, 2) : ""}
            className="font-mono text-xs"
            rows={4}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={isPending} className="self-start">
            {isPending ? "Speichern..." : "Mapping speichern"}
          </Button>
        </form>

        <div>
          <p className="mb-2 text-sm font-medium">Letzte Eingänge</p>
          <div className="flex flex-col gap-1">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center justify-between text-xs">
                <span className={delivery.error ? "text-destructive" : "text-muted-foreground"}>
                  {delivery.error ? `Fehler: ${delivery.error}` : "Erfolgreich verarbeitet"}
                </span>
                <span className="text-muted-foreground">{delivery.createdAt}</span>
              </div>
            ))}
            {deliveries.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Eingänge.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
