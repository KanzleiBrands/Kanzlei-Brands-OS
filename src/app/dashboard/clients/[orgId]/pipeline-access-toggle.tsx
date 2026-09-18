"use client";

import { useTransition } from "react";
import { setPipelineAccess } from "@/lib/actions/organizations";

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
    <input
      type="checkbox"
      defaultChecked={granted}
      disabled={isPending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("pipelineId", pipelineId);
        formData.set("grant", String(event.target.checked));
        startTransition(() => {
          setPipelineAccess(formData);
        });
      }}
    />
  );
}
