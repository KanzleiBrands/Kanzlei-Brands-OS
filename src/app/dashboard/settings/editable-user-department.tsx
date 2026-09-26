"use client";

import { useState, useTransition } from "react";
import type { AgencyDepartment } from "@prisma/client";
import { updateAgencyUserDepartment } from "@/lib/actions/organizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

const NONE = "__none__";

export function EditableUserDepartment({
  userId,
  department,
  required,
}: {
  userId: string;
  department: AgencyDepartment | null;
  /** AGENCY_STAFF braucht zwingend eine Abteilung, AGENCY_ADMIN darf auch keine haben. */
  required: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending);

  function handleChange(value: string | null) {
    const next = value === NONE ? null : (value as AgencyDepartment | null);
    startTransition(async () => {
      const result = await updateAgencyUserDepartment(userId, next);
      setError(result);
    });
  }

  return (
    <Select value={department ?? NONE} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="h-7 min-w-[9rem]">
        <SelectValue>
          {(value) => (value === NONE ? "Keine Abteilung" : DEPARTMENT_LABELS[value as AgencyDepartment])}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value={NONE}>Keine Abteilung</SelectItem>}
        {AGENCY_DEPARTMENTS.map((dep) => (
          <SelectItem key={dep} value={dep}>
            {DEPARTMENT_LABELS[dep]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
