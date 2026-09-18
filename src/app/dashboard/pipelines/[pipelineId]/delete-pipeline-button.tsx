"use client";

import { useTransition } from "react";
import { deletePipeline } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";

export function DeletePipelineButton({ pipelineId, pipelineName }: { pipelineId: string; pipelineName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            `"${pipelineName}" wirklich löschen? Alle Kontakte und Aktivitäten dieser Kampagne werden unwiderruflich gelöscht.`,
          )
        ) {
          return;
        }
        const formData = new FormData();
        formData.set("pipelineId", pipelineId);
        startTransition(() => {
          deletePipeline(formData);
        });
      }}
    >
      {isPending ? "Wird gelöscht..." : "Kampagne löschen"}
    </Button>
  );
}
