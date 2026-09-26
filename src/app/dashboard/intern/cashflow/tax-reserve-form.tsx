"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setTaxReservePercent } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

export function TaxReserveForm({ organizationId, cashflowTaxReservePercent }: { organizationId: string; cashflowTaxReservePercent: number | null }) {
  const [value, setValue] = useState(cashflowTaxReservePercent != null ? String(cashflowTaxReservePercent) : "");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(error, isPending, "Steuerrücklage gespeichert.");

  function save() {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("cashflowTaxReservePercent", value);
    startTransition(async () => {
      setError(await setTaxReservePercent(formData));
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Steuerrücklage (%)</label>
        <Input type="number" min={0} max={100} value={value} disabled={isPending} onChange={(e) => setValue(e.target.value)} className="h-9 w-28" />
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={save}>Speichern</Button>
    </div>
  );
}
