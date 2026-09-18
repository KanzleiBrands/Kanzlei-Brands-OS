"use client";

import { useTransition } from "react";
import { setCourseAssignment } from "@/lib/actions/courses";

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
    <input
      type="checkbox"
      defaultChecked={assigned}
      disabled={isPending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("courseId", courseId);
        formData.set("assign", String(event.target.checked));
        startTransition(() => {
          setCourseAssignment(formData);
        });
      }}
    />
  );
}
