"use client";

import { useState, useTransition } from "react";
import type { AgencyDepartment } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateDepartmentContact } from "@/lib/actions/department-hub";
import { useSaveToast } from "@/hooks/use-save-toast";

const NONE = "__none__";

export function DepartmentContactSelect({
  department,
  contactUserId,
  candidates,
}: {
  department: AgencyDepartment;
  contactUserId: string | null;
  candidates: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending);

  function handleChange(value: string | null) {
    const next = value === NONE ? null : value;
    startTransition(async () => {
      const result = await updateDepartmentContact(department, next);
      setError(result);
    });
  }

  const labelById = new Map(candidates.map((c) => [c.id, c.name]));

  return (
    <Select value={contactUserId ?? NONE} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-full sm:w-56">
        <SelectValue>{(value) => (value === NONE ? "Kein Ansprechpartner" : (labelById.get(value) ?? "?"))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Kein Ansprechpartner</SelectItem>
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
