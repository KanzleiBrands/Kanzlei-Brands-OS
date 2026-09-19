"use client";

import { useTransition } from "react";
import { moveContactStage } from "@/lib/actions/contacts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function StageDot({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block size-2 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}

export function StageSelectForm({
  contactId,
  currentStageId,
  stages,
}: {
  contactId: string;
  currentStageId: string;
  stages: { id: string; name: string; color: string | null }[];
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
        <SelectValue>
          {(value: string) => {
            const stage = stages.find((s) => s.id === value);
            return (
              <span className="flex items-center gap-1.5">
                <StageDot color={stage?.color ?? null} />
                {stage?.name ?? "Stage"}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {stages.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            <span className="flex items-center gap-1.5">
              <StageDot color={stage.color} />
              {stage.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
