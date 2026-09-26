"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setProfitGoal } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

export function ProfitGoalForm({ organizationId, profitGoalAnnual }: { organizationId: string; profitGoalAnnual: number | null }) {
  const [value, setValue] = useState(profitGoalAnnual != null ? String(profitGoalAnnual) : "");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(error, isPending, "Jahresziel gespeichert.");

  function save() {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("profitGoalAnnual", value);
    startTransition(async () => {
      setError(await setProfitGoal(formData));
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Profitgoal (Jahr, netto in €)</label>
        <Input
          type="number"
          min={0}
          value={value}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-40"
        />
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={save}>
        Speichern
      </Button>
    </div>
  );
}
