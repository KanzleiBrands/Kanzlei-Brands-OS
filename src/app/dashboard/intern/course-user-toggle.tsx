"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setCourseUserAssignment } from "@/lib/actions/courses";
import { Checkbox } from "@/components/ui/checkbox";

export function CourseUserToggle({
  userId,
  courseId,
  assigned,
  assignable = true,
}: {
  userId: string;
  courseId: string;
  assigned: boolean;
  /** false = außerhalb der eigenen Abteilung(en) eines beschränkten Kursmanagers - siehe canAssignDepartment. */
  assignable?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      defaultChecked={assigned}
      disabled={isPending || !assignable}
      onCheckedChange={(checked) => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("courseId", courseId);
        formData.set("assign", String(checked));
        startTransition(async () => {
          try {
            await setCourseUserAssignment(formData);
            toast.success("Gespeichert.");
          } catch {
            toast.error("Konnte nicht gespeichert werden.");
          }
        });
      }}
    />
  );
}
