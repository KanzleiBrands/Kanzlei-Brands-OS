"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setPipelineAccess } from "@/lib/actions/organizations";
import { Checkbox } from "@/components/ui/checkbox";

export function PipelineAccessToggle({
  userId,
  pipelineId,
  granted,
}: {
  userId: string;
  pipelineId: string;
  granted: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      defaultChecked={granted}
      disabled={isPending}
      onCheckedChange={(checked) => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("pipelineId", pipelineId);
        formData.set("grant", String(checked));
        startTransition(async () => {
          try {
            await setPipelineAccess(formData);
            toast.success("Gespeichert.");
          } catch {
            toast.error("Konnte nicht gespeichert werden.");
          }
        });
      }}
    />
  );
}
