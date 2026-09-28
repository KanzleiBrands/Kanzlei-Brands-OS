"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { AgencyDepartment } from "@prisma/client";
import { updateAgencyUserDepartments } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

/**
 * Mehrfachauswahl statt Single-Select - ein Mitarbeiter kann mehrere Rollen
 * gleichzeitig haben (z.B. Fulfillment + internes Marketing), siehe
 * updateAgencyUserDepartments.
 */
export function EditableUserDepartment({
  userId,
  departments,
  required,
}: {
  userId: string;
  departments: AgencyDepartment[];
  /** AGENCY_STAFF braucht zwingend mindestens eine Abteilung, AGENCY_ADMIN darf auch keine haben. */
  required: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AgencyDepartment[]>(departments);
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending);

  function toggle(dep: AgencyDepartment, checked: boolean) {
    const next = checked ? [...selected, dep] : selected.filter((d) => d !== dep);
    if (required && next.length === 0) return;
    setSelected(next);
    startTransition(async () => {
      const result = await updateAgencyUserDepartments(userId, next);
      setError(result);
      if (result) setSelected(selected);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 min-w-[9rem] justify-between font-normal" disabled={isPending} />
        }
      >
        <span className="truncate">
          {selected.length === 0 ? "Keine Abteilung" : selected.map((d) => DEPARTMENT_LABELS[d]).join(", ")}
        </span>
        <ChevronDownIcon className="size-3.5 flex-shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {AGENCY_DEPARTMENTS.map((dep) => (
          <DropdownMenuCheckboxItem
            key={dep}
            checked={selected.includes(dep)}
            onCheckedChange={(checked) => toggle(dep, checked === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {DEPARTMENT_LABELS[dep]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
