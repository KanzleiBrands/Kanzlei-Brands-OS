"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveToast } from "@/hooks/use-save-toast";
import { setCashflowAccess } from "@/lib/actions/cashflow";

/**
 * Sichtbar/bedienbar nur für den Super-Admin (siehe src/lib/super-admin.ts) -
 * gibt der GF eine direkte, sofort sichtbare Kontrolle darüber, wer Zugriff
 * auf das Cashflow Cockpit hat, statt sich auf den Code allein verlassen zu
 * müssen (siehe SICHERHEITSFIX-Commit zum versehentlichen AGENCY_ADMIN-Leak).
 */
export function EditableCashflowAccess({
  userId,
  hasCashflowAccess,
  lockedOn,
}: {
  userId: string;
  hasCashflowAccess: boolean;
  /** true = Zugriff kommt über department=EXECUTIVE oder die Owner-E-Mail, die Checkbox ändert daran nichts. */
  lockedOn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(hasCashflowAccess);
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending);

  function handleChange(next: boolean) {
    setChecked(next);
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("hasCashflowAccess", String(next));
    startTransition(async () => {
      const result = await setCashflowAccess(formData);
      setError(result);
      if (result) setChecked(!next);
    });
  }

  return (
    <div className="flex items-center gap-1.5" title={lockedOn ? "Zugriff aktiv über Abteilung/Owner-Konto, nicht über diese Checkbox" : undefined}>
      <Checkbox
        checked={lockedOn ? true : checked}
        disabled={isPending || lockedOn}
        onCheckedChange={(value) => handleChange(value === true)}
      />
    </div>
  );
}
