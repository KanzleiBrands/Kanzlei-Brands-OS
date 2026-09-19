"use client";

import { useState, useTransition } from "react";
import { moveContactStage } from "@/lib/actions/contacts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RejectionReasonDialog } from "@/components/rejection-reason-dialog";

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
  pipelineKind,
  stages,
}: {
  contactId: string;
  currentStageId: string;
  pipelineKind: string;
  stages: { id: string; name: string; color: string | null; isRejected: boolean }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(currentStageId);
  const [pendingRejectStageId, setPendingRejectStageId] = useState<string | null>(null);

  function moveTo(stageId: string, rejectionReason?: string) {
    setValue(stageId);
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("stageId", stageId);
    if (rejectionReason) formData.set("rejectionReason", rejectionReason);
    startTransition(() => {
      moveContactStage(formData);
    });
  }

  return (
    <>
      <Select
        value={value}
        disabled={isPending}
        onValueChange={(stageId) => {
          if (!stageId) return;
          const stage = stages.find((s) => s.id === stageId);
          if (stage?.isRejected) {
            setPendingRejectStageId(stageId);
          } else {
            moveTo(stageId);
          }
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue>
            {(stageId: string) => {
              const stage = stages.find((s) => s.id === stageId);
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

      <RejectionReasonDialog
        open={!!pendingRejectStageId}
        onOpenChange={(open) => {
          if (!open) setPendingRejectStageId(null);
        }}
        pipelineKind={pipelineKind}
        isPending={isPending}
        onConfirm={(reason) => {
          if (!pendingRejectStageId) return;
          moveTo(pendingRejectStageId, reason);
          setPendingRejectStageId(null);
        }}
      />
    </>
  );
}
