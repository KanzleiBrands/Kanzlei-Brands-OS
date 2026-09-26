"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { AgencyDepartment } from "@prisma/client";
import { setCourseDepartmentAssignment } from "@/lib/actions/courses";
import { Checkbox } from "@/components/ui/checkbox";

export function CourseDepartmentToggle({
  department,
  courseId,
  assigned,
}: {
  department: AgencyDepartment;
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
        formData.set("department", department);
        formData.set("courseId", courseId);
        formData.set("assign", String(checked));
        startTransition(async () => {
          try {
            await setCourseDepartmentAssignment(formData);
            toast.success("Gespeichert.");
          } catch {
            toast.error("Konnte nicht gespeichert werden.");
          }
        });
      }}
    />
  );
}
