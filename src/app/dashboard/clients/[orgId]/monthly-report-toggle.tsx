"use client";

import { useTransition } from "react";
import { updateMonthlyReportSetting } from "@/lib/actions/organizations";

export function MonthlyReportToggle({
  organizationId,
  enabled,
}: {
  organizationId: string;
  enabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={enabled}
        disabled={isPending}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          formData.set("monthlyReportEnabled", String(e.target.checked));
          startTransition(() => {
            updateMonthlyReportSetting(formData);
          });
        }}
      />
      Performance-Report monatlich per E-Mail verschicken
    </label>
  );
}
