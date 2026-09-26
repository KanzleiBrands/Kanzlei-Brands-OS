"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { setAbsenceBalance } from "@/lib/actions/hr";
import { useSaveToast } from "@/hooks/use-save-toast";

export function BalanceCell({
  userId,
  absenceTypeId,
  year,
  totalDays,
}: {
  userId: string;
  absenceTypeId: string;
  year: number;
  totalDays: number;
}) {
  const [value, setValue] = useState(String(totalDays));
  const [isPending, startTransition] = useTransition();
  useSaveToast(undefined, isPending, "Kontingent gespeichert.");

  function save() {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("absenceTypeId", absenceTypeId);
    formData.set("year", String(year));
    formData.set("totalDays", value);
    startTransition(async () => {
      await setAbsenceBalance(formData);
    });
  }

  return (
    <Input
      type="number"
      min={0}
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== String(totalDays)) save();
      }}
      className="h-8 w-20"
    />
  );
}
