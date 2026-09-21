"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectMetaLeadForm } from "@/lib/actions/meta-integration";

type Delivery = { id: string; createdAt: string; error: string | null; contactId: string | null };
type Connection = {
  id: string;
  pageName: string | null;
  formName: string | null;
  active: boolean;
  lastError: string | null;
  deliveries: Delivery[];
};

function ConnectionCard({ connection }: { connection: Connection }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{connection.pageName ?? "Facebook-Seite"}</p>
          <p className="text-sm text-muted-foreground">{connection.formName ?? "Lead-Formular"}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => disconnectMetaLeadForm(connection.id))}
        >
          {isPending ? "..." : "Trennen"}
        </Button>
      </div>

      {!connection.active && (
        <p className="mb-3 text-sm text-destructive">
          Verbindung unterbrochen{connection.lastError ? `: ${connection.lastError}` : ""} - bitte trennen und neu
          verbinden.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Letzte Eingänge</p>
        <div className="flex flex-col gap-1">
          {connection.deliveries.map((delivery) => (
            <div key={delivery.id} className="flex items-center justify-between border-b pb-1 text-xs last:border-0">
              <span className={delivery.error ? "text-destructive" : "text-muted-foreground"}>
                {delivery.error ? `Fehler: ${delivery.error}` : "Erfolgreich verarbeitet"}
              </span>
              <span className="text-muted-foreground">{delivery.createdAt}</span>
            </div>
          ))}
          {connection.deliveries.length === 0 && (
            <p className="text-xs text-muted-foreground">Noch keine Eingänge.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MetaConnectionsPanel({
  pipelineId,
  connections,
  metaConfigured,
}: {
  pipelineId: string;
  connections: Connection[];
  metaConfigured: boolean;
}) {
  if (!metaConfigured && connections.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Meta Lead Ads</CardTitle>
        {metaConfigured && (
          <Button
            type="button"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/meta/connect?pipelineId=${pipelineId}`} />}
          >
            + Verbinden
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connections.map((connection) => (
          <ConnectionCard key={connection.id} connection={connection} />
        ))}
        {connections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Facebook-Seite verbunden. Instant-Formular-Leads landen nach dem Verbinden automatisch hier -
            ganz ohne Zapier.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Voraussetzung zum Verbinden: die Facebook-Seite muss dir im Business Manager mit der Aufgabe
          &bdquo;Seite verwalten&ldquo; (oder höher) zugewiesen sein - reiner Lesezugriff reicht nicht. Solange die
          Meta-App im Entwicklungsmodus läuft, musst du außerdem im Meta-Entwicklerportal unter App-Rollen als
          Tester/Entwickler/Admin eingetragen sein, sonst zeigt Facebook beim Verbinden gar keine Berechtigungsabfrage
          an.
        </p>
      </CardContent>
    </Card>
  );
}
