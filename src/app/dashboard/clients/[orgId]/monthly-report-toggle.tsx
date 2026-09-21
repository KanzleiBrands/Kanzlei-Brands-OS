"use client";

import { useTransition } from "react";
import { updateMonthlyReportSetting } from "@/lib/actions/organizations";
import { Checkbox } from "@/components/ui/checkbox";

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
      <Checkbox
        defaultChecked={enabled}
        disabled={isPending}
        onCheckedChange={(checked) => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          formData.set("monthlyReportEnabled", String(checked));
          startTransition(() => {
            updateMonthlyReportSetting(formData);
          });
        }}
      />
      Performance-Report monatlich per E-Mail verschicken
    </label>
  );
}
