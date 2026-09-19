"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { updateLocationRouting } from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Route = { location: string; pipelineId: string };
type SiblingPipeline = { id: string; name: string; location: string | null };

function routingToArray(routing: unknown, siblings: SiblingPipeline[]): Route[] {
  if (!routing || typeof routing !== "object" || Array.isArray(routing)) return [];
  return Object.entries(routing as Record<string, string>)
    .filter(([, pipelineId]) => siblings.some((s) => s.id === pipelineId))
    .map(([location, pipelineId]) => ({ location, pipelineId }));
}

export function LocationRoutingEditor({
  endpointId,
  routing,
  siblings,
}: {
  endpointId: string;
  routing: unknown;
  siblings: SiblingPipeline[];
}) {
  const [error, formAction, isPending] = useActionState(updateLocationRouting, undefined);
  const [routes, setRoutes] = useState<Route[]>(() => routingToArray(routing, siblings));
  const wasPending = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  if (siblings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst eine weitere Kampagne für einen anderen Standort an, um Bewerbungen aus diesem einen Webhook
        automatisch zuzuordnen.
      </p>
    );
  }

  const jsonValue = JSON.stringify(Object.fromEntries(routes.filter((r) => r.location && r.pipelineId).map((r) => [r.location, r.pipelineId])));

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="endpointId" value={endpointId} />
      <input type="hidden" name="locationRouting" value={jsonValue} />
      <p className="text-sm text-muted-foreground">
        Antwortet ein Bewerber im Funnel mit einem der folgenden Standorte, landet er automatisch in der jeweiligen
        Kampagne statt hier.
      </p>
      {routes.map((route, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={route.location}
            placeholder="Standort-Antwort (z.B. Hamburg)"
            className="max-w-48"
            onChange={(e) => {
              const next = [...routes];
              next[index] = { ...next[index], location: e.target.value };
              setRoutes(next);
            }}
          />
          <Select
            value={route.pipelineId}
            onValueChange={(value) => {
              if (!value) return;
              const next = [...routes];
              next[index] = { ...next[index], pipelineId: value };
              setRoutes(next);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {(value: string) => siblings.find((s) => s.id === value)?.name ?? "Ziel-Kampagne wählen"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {siblings.map((sibling) => (
                <SelectItem key={sibling.id} value={sibling.id}>
                  {sibling.name}
                  {sibling.location ? ` (${sibling.location})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => setRoutes(routes.filter((_, i) => i !== index))}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setRoutes([...routes, { location: "", pipelineId: "" }])}
      >
        <PlusIcon className="size-4" />
        Zuordnung hinzufügen
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : saved ? "Gespeichert!" : "Zuordnung speichern"}
      </Button>
    </form>
  );
}
