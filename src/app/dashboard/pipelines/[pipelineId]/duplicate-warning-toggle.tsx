"use client";

import { useTransition } from "react";
import { toggleDuplicateWarning } from "@/lib/actions/organizations";
import { Checkbox } from "@/components/ui/checkbox";

export function DuplicateWarningToggle({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        defaultChecked={enabled}
        disabled={isPending}
        onCheckedChange={() => {
          const formData = new FormData();
          formData.set("pipelineId", pipelineId);
          startTransition(() => {
            toggleDuplicateWarning(formData);
          });
        }}
      />
      Duplikat-Hinweis anzeigen
    </label>
  );
}
