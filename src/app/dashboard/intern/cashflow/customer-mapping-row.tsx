"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { mapEasybillCustomer, unmapEasybillCustomer } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

type ClientOrg = { id: string; name: string };

export function CustomerMappingRow({
  organizationId,
  easybillCustomerId,
  easybillLabel,
  mappedOrganization,
  unmappedClients,
}: {
  organizationId: string;
  easybillCustomerId: number;
  easybillLabel: string;
  mappedOrganization: ClientOrg | null;
  unmappedClients: ClientOrg[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(error, isPending, "Zuordnung gespeichert.");

  if (mappedOrganization) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <span>
          {easybillLabel} <span className="text-muted-foreground">→ {mappedOrganization.name}</span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("clientOrganizationId", mappedOrganization.id);
            startTransition(async () => {
              await unmapEasybillCustomer(formData);
            });
          }}
        >
          Zuordnung aufheben
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm">
      <span>{easybillLabel}</span>
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={(value) => setSelected(value ?? "")} disabled={isPending}>
          <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
          <SelectContent>
            {unmappedClients.map((client) => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !selected}
          onClick={() => {
            const formData = new FormData();
            formData.set("organizationId", organizationId);
            formData.set("clientOrganizationId", selected);
            formData.set("easybillCustomerId", String(easybillCustomerId));
            startTransition(async () => {
              setError(await mapEasybillCustomer(formData));
            });
          }}
        >
          Zuordnen
        </Button>
      </div>
    </div>
  );
}
