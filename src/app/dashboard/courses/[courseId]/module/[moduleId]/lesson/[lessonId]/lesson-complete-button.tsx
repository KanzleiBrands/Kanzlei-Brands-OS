"use client";

import { useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { toggleLessonComplete } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function LessonCompleteButton({
  lessonId,
  completed,
  disabled = false,
}: {
  lessonId: string;
  completed: boolean;
  /** Shown but inert in preview mode, so agency admins can see the real layout without saving fake progress. */
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={completed ? "outline" : "default"}
      disabled={isPending || disabled}
      title={disabled ? "Fortschritt wird in der Vorschau nicht gespeichert." : undefined}
      className={!completed && !disabled ? "bg-emerald-600 text-white hover:bg-emerald-500" : undefined}
      onClick={() => {
        const formData = new FormData();
        formData.set("lessonId", lessonId);
        formData.set("complete", String(!completed));
        startTransition(async () => {
          try {
            await toggleLessonComplete(formData);
            toast.success(completed ? "Als offen markiert." : "Lektion abgeschlossen.");
          } catch {
            toast.error("Konnte nicht gespeichert werden.");
          }
        });
      }}
    >
      <CheckIcon className="size-4" />
      {completed ? "Abgeschlossen" : "Lektion abschließen"}
    </Button>
  );
}
