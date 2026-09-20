"use client";

import { useActionState, useState } from "react";
import { updateFieldMapping, updateMinCallDuration } from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WEBHOOK_SOURCE_COLORS, WEBHOOK_SOURCE_LABELS } from "@/lib/webhook-source-labels";
import { AddSourceDialog } from "./add-source-dialog";
import { LocationRoutingEditor } from "./location-routing-editor";

type Delivery = {
  id: string;
  createdAt: string;
  error: string | null;
  skippedReason: string | null;
  contactId: string | null;
  rawPayload: unknown;
};

type Endpoint = {
  id: string;
  source: string;
  url: string;
  fieldMapping: unknown;
  locationRouting: unknown;
  minCallDurationSeconds: number | null;
  deliveries: Delivery[];
};

type SiblingPipeline = { id: string; name: string; location: string | null };

function MinCallDurationForm({ endpointId, minCallDurationSeconds }: { endpointId: string; minCallDurationSeconds: number | null }) {
  const [error, formAction, isPending] = useActionState(updateMinCallDuration, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="endpointId" value={endpointId} />
      <Input
        type="number"
        name="minCallDurationSeconds"
        min={0}
        step={1}
        placeholder="Deaktiviert"
        defaultValue={minCallDurationSeconds ?? ""}
        className="w-32"
      />
      <span className="text-sm text-muted-foreground">Sek. Mindestdauer, darunter kein Lead</span>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "..." : "Speichern"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const [showRaw, setShowRaw] = useState(false);
  const statusLabel = delivery.error
    ? `Fehler: ${delivery.error}`
    : delivery.skippedReason
      ? delivery.skippedReason
      : "Erfolgreich verarbeitet";
  const statusClass = delivery.error
    ? "text-destructive"
    : delivery.skippedReason
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <div className="border-b pb-1 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={statusClass}>{statusLabel}</span>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-muted-foreground">{delivery.createdAt}</span>
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {showRaw ? "Rohdaten verbergen" : "Rohdaten"}
          </button>
        </div>
      </div>
      {showRaw && (
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(delivery.rawPayload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function EndpointCard({ endpoint, siblings }: { endpoint: Endpoint; siblings: SiblingPipeline[] }) {
  const [error, formAction, isPending] = useActionState(updateFieldMapping, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: WEBHOOK_SOURCE_COLORS[endpoint.source] }}
        >
          {WEBHOOK_SOURCE_LABELS[endpoint.source]?.[0] ?? "?"}
        </span>
        <p className="text-sm font-medium">{WEBHOOK_SOURCE_LABELS[endpoint.source] ?? endpoint.source}</p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{endpoint.url}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(endpoint.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Kopiert!" : "Kopieren"}
        </Button>
      </div>

      {endpoint.source === "MATELSO" && (
        <div className="mb-3">
          <p className="mb-1 text-sm text-muted-foreground">
            matelso in wenigen Schritten anbinden: Diese URL im matelso-Adminbereich als Push-/Webhook-Ziel
            hinterlegen, einen Testanruf auslösen, dann unten unter „Rohdaten“ nachsehen, wie das JSON aussieht, und
            darauf basierend das Feld-Mapping (z.B. Anrufer-Nummer → <code>phone</code>, Anrufdauer →{" "}
            <code>callDurationSeconds</code>) sowie die Mindestdauer eintragen.
          </p>
          <MinCallDurationForm endpointId={endpoint.id} minCallDurationSeconds={endpoint.minCallDurationSeconds} />
        </div>
      )}

      <details className="mb-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Feld-Mapping (optional)</summary>
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="endpointId" value={endpoint.id} />
          <Textarea
            name="fieldMapping"
            placeholder={
              endpoint.source === "MATELSO"
                ? '{"phone": "caller_number", "callDurationSeconds": "duration"}'
                : '{"email": "data.email", "firstName": "data.first_name"}'
            }
            defaultValue={endpoint.fieldMapping ? JSON.stringify(endpoint.fieldMapping, null, 2) : ""}
            className="font-mono text-xs"
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={isPending} className="self-start">
            {isPending ? "Speichern..." : "Mapping speichern"}
          </Button>
        </form>
      </details>

      {siblings.length > 0 && (
        <details className="mb-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Standort-Zuordnung (optional)</summary>
          <div className="mt-2">
            <LocationRoutingEditor endpointId={endpoint.id} routing={endpoint.locationRouting} siblings={siblings} />
          </div>
        </details>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Letzte Eingänge</p>
        <div className="flex flex-col gap-1.5">
          {endpoint.deliveries.map((delivery) => (
            <DeliveryRow key={delivery.id} delivery={delivery} />
          ))}
          {endpoint.deliveries.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Eingänge.</p>}
        </div>
      </div>
    </div>
  );
}

export function WebhookPanel({
  pipelineId,
  endpoints,
  siblingPipelines = [],
}: {
  pipelineId: string;
  endpoints: Endpoint[];
  siblingPipelines?: SiblingPipeline[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Lead-Quellen</CardTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/pipelines/${pipelineId}/export`} download />}
          >
            CSV exportieren
          </Button>
          <AddSourceDialog pipelineId={pipelineId} existingSources={endpoints.map((e) => e.source)} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {endpoints.map((endpoint) => (
          <EndpointCard key={endpoint.id} endpoint={endpoint} siblings={siblingPipelines} />
        ))}
        {endpoints.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Quelle eingerichtet.</p>}
      </CardContent>
    </Card>
  );
}
