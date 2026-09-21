"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateStageTemplate } from "@/lib/actions/stage-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StageListEditor, type EditableStage } from "./stage-list-editor";
import { useSaveToast } from "@/hooks/use-save-toast";

export function EditStageTemplateDialog({
  templateId,
  name,
  stages,
}: {
  templateId: string;
  name: string;
  stages: EditableStage[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(updateStageTemplate, undefined);
  useSaveToast(error, isPending);
  const [stagesState, setStagesState] = useState<EditableStage[]>(stages);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStagesState(stages);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon className="size-3.5" />
        Bearbeiten
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorlage bearbeiten</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="stages" value={JSON.stringify(stagesState)} />
          <Input name="name" defaultValue={name} placeholder="Name der Vorlage" required />
          <StageListEditor initialStages={stagesState} onChange={setStagesState} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Speichern..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
