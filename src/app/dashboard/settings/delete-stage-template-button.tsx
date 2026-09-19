"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteStageTemplate } from "@/lib/actions/stage-templates";
import { Button } from "@/components/ui/button";

export function DeleteStageTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Vorlage löschen"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`Vorlage "${templateName}" wirklich löschen? Bereits erstellte Kampagnen sind davon nicht betroffen.`)) {
          return;
        }
        const formData = new FormData();
        formData.set("id", templateId);
        startTransition(() => {
          deleteStageTemplate(formData);
        });
      }}
    >
      <Trash2Icon className="size-4 text-muted-foreground" />
    </Button>
  );
}
