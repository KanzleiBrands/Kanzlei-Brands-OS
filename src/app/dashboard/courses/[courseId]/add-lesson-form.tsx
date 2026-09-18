"use client";

import { useActionState, useRef } from "react";
import { addLesson } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddLessonForm({ courseId }: { courseId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, formData: FormData) => {
    const result = await addLesson(prev, formData);
    if (!result) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2" encType="multipart/form-data">
      <input type="hidden" name="courseId" value={courseId} />
      <Input name="title" placeholder="Lektionstitel" required className="max-w-xs" />
      <Input name="video" type="file" accept="video/*" className="max-w-xs" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird hochgeladen..." : "Lektion hinzufügen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
