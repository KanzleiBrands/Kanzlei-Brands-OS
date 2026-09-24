"use client";

import { useTransition } from "react";
import { ChevronUpIcon, ChevronDownIcon, Trash2Icon } from "lucide-react";
import { moveLesson, deleteLesson } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function LessonRowActions({
  lessonId,
  lessonTitle,
  canMoveUp,
  canMoveDown,
}: {
  lessonId: string;
  lessonTitle: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("direction", direction);
    startTransition(() => {
      moveLesson(formData);
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending || !canMoveUp}
        aria-label="Lektion nach oben"
        onClick={() => move("up")}
      >
        <ChevronUpIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending || !canMoveDown}
        aria-label="Lektion nach unten"
        onClick={() => move("down")}
      >
        <ChevronDownIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        aria-label="Lektion löschen"
        onClick={() => {
          if (!window.confirm(`"${lessonTitle}" wirklich löschen?`)) return;
          const formData = new FormData();
          formData.set("lessonId", lessonId);
          startTransition(() => {
            deleteLesson(formData);
          });
        }}
      >
        <Trash2Icon className="size-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
