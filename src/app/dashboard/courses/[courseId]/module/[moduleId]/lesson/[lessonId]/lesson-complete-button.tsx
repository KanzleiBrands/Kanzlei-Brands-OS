"use client";

import { useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { toggleLessonComplete } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function LessonCompleteButton({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={completed ? "outline" : "default"}
      disabled={isPending}
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
