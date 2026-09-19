"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createStageTemplate } from "@/lib/actions/stage-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StageListEditor, type EditableStage } from "./stage-list-editor";
import { STAGE_COLOR_PALETTE } from "@/lib/stage-colors";

const BLANK_STAGE: EditableStage[] = [{ name: "Neu", color: STAGE_COLOR_PALETTE[0] }];

export function NewStageTemplateDialog({
  existingTemplates,
}: {
  existingTemplates: { id: string; name: string; stages: EditableStage[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createStageTemplate, undefined);
  const [cloneFromId, setCloneFromId] = useState<string>("blank");
  const [stagesState, setStagesState] = useState<EditableStage[]>(BLANK_STAGE);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setStagesState(BLANK_STAGE);
      setCloneFromId("blank");
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Neue Vorlage
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorlage anlegen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Input name="name" placeholder="Name (z.B. Kundenname)" required />

          {existingTemplates.length > 0 && (
            <Select
              value={cloneFromId}
              onValueChange={(value) => {
                if (!value) return;
                setCloneFromId(value);
                const template = existingTemplates.find((t) => t.id === value);
                setStagesState(template ? template.stages : BLANK_STAGE);
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value: string) =>
                    value === "blank" ? "Leer starten" : (existingTemplates.find((t) => t.id === value)?.name ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Leer starten</SelectItem>
                {existingTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    Basierend auf &bdquo;{template.name}&ldquo;
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <input type="hidden" name="stages" value={JSON.stringify(stagesState)} />
          <StageListEditor key={cloneFromId} initialStages={stagesState} onChange={setStagesState} />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Vorlage anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
