"use client";

import { useTransition } from "react";
import { toggleLessonComplete } from "@/lib/actions/courses";

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
      <input
        type="checkbox"
        defaultChecked={completed}
        disabled={isPending}
        onChange={(event) => {
          const formData = new FormData();
          formData.set("courseId", courseId);
          formData.set("lessonId", lessonId);
          formData.set("complete", String(event.target.checked));
          startTransition(() => {
            toggleLessonComplete(formData);
          });
        }}
      />
      Abgeschlossen
    </label>
  );
}
