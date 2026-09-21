"use client";

import { useTransition } from "react";
import { setCourseAssignment } from "@/lib/actions/courses";
import { Checkbox } from "@/components/ui/checkbox";

export function CourseAssignmentToggle({
  organizationId,
  courseId,
  assigned,
}: {
  organizationId: string;
  courseId: string;
  assigned: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      defaultChecked={assigned}
      disabled={isPending}
      onCheckedChange={(checked) => {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("courseId", courseId);
        formData.set("assign", String(checked));
        startTransition(() => {
          setCourseAssignment(formData);
        });
      }}
    />
  );
}
