"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { setCashflowCost } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

export function CostCell({
  organizationId,
  category,
  year,
  month,
  amountNet,
}: {
  organizationId: string;
  category: string;
  year: number;
  month: number;
  amountNet: number;
}) {
  const [value, setValue] = useState(String(amountNet));
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(error, isPending, "Kosten gespeichert.");

  function save() {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("category", category);
    formData.set("year", String(year));
    formData.set("month", String(month));
    formData.set("amountNet", value);
    startTransition(async () => {
      setError(await setCashflowCost(formData));
    });
  }

  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (Number(value) !== amountNet) save();
      }}
      className="h-8 w-24 text-right"
    />
  );
}
