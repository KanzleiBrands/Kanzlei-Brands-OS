"use client";

import { useTransition } from "react";
import { togglePublish } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";

export function PublishToggle({
  courseId,
  published,
  className,
}: {
  courseId: string;
  published: boolean;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={published ? "outline" : "default"}
      disabled={isPending}
      className={className}
      onClick={() => {
        const formData = new FormData();
        formData.set("courseId", courseId);
        startTransition(() => {
          togglePublish(formData);
        });
      }}
    >
      {published ? "Veröffentlicht" : "Entwurf – veröffentlichen"}
    </Button>
  );
}
