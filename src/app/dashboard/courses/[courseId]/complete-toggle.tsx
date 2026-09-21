"use client";

import { useTransition } from "react";
import { toggleLessonComplete } from "@/lib/actions/courses";
import { Checkbox } from "@/components/ui/checkbox";

export function CompleteToggle({
  courseId,
  lessonId,
  completed,
}: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        defaultChecked={completed}
        disabled={isPending}
        onCheckedChange={(checked) => {
          const formData = new FormData();
          formData.set("courseId", courseId);
          formData.set("lessonId", lessonId);
          formData.set("complete", String(checked));
          startTransition(() => {
            toggleLessonComplete(formData);
          });
        }}
      />
      Abgeschlossen
    </label>
  );
}
