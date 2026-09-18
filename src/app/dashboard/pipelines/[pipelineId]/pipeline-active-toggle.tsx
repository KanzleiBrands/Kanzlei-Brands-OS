"use client";

import { useTransition } from "react";
import { togglePipelineActive } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";

export function PipelineActiveToggle({ pipelineId, active }: { pipelineId: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("pipelineId", pipelineId);
        startTransition(() => {
          togglePipelineActive(formData);
        });
      }}
    >
      {active ? "Aktiv" : "Pausiert"}
    </Button>
  );
}
