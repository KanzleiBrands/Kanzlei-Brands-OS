"use client";

import { useTransition } from "react";
import { moveContactStage } from "@/lib/actions/contacts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StageSelectForm({
  contactId,
  currentStageId,
  stages,
}: {
  contactId: string;
  currentStageId: string;
  stages: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={currentStageId}
      disabled={isPending}
      onValueChange={(stageId) => {
        const formData = new FormData();
        formData.set("contactId", contactId);
        formData.set("stageId", stageId as string);
        startTransition(() => {
          moveContactStage(formData);
        });
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue>{(value: string) => stages.find((s) => s.id === value)?.name ?? "Stage"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {stages.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            {stage.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
