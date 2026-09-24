"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { deleteCourse } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function DeleteCourseButton({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`"${courseTitle}" wirklich löschen? Alle Module, Lektionen und Fortschritte gehen verloren.`)) {
          return;
        }
        const formData = new FormData();
        formData.set("courseId", courseId);
        startTransition(async () => {
          await deleteCourse(formData);
          router.push("/dashboard/courses");
        });
      }}
    >
      <Trash2Icon className="size-4 text-destructive" />
      Kurs löschen
    </Button>
  );
}
