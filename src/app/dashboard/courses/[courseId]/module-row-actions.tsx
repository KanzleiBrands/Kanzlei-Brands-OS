"use client";

import { useTransition } from "react";
import { ChevronUpIcon, ChevronDownIcon, Trash2Icon } from "lucide-react";
import { moveModule, deleteModule } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function ModuleRowActions({
  moduleId,
  moduleTitle,
  canMoveUp,
  canMoveDown,
}: {
  moduleId: string;
  moduleTitle: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const formData = new FormData();
    formData.set("moduleId", moduleId);
    formData.set("direction", direction);
    startTransition(() => {
      moveModule(formData);
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending || !canMoveUp}
        aria-label="Modul nach oben"
        onClick={() => move("up")}
      >
        <ChevronUpIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending || !canMoveDown}
        aria-label="Modul nach unten"
        onClick={() => move("down")}
      >
        <ChevronDownIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        aria-label="Modul löschen"
        onClick={() => {
          if (!window.confirm(`"${moduleTitle}" wirklich löschen? Alle Lektionen darin gehen verloren.`)) return;
          const formData = new FormData();
          formData.set("moduleId", moduleId);
          startTransition(() => {
            deleteModule(formData);
          });
        }}
      >
        <Trash2Icon className="size-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
