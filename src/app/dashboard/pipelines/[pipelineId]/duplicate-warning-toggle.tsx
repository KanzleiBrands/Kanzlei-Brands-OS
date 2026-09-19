"use client";

import { useTransition } from "react";
import { toggleDuplicateWarning } from "@/lib/actions/organizations";

export function DuplicateWarningToggle({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={enabled}
        disabled={isPending}
        onChange={() => {
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
