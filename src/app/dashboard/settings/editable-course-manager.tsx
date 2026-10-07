"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { AgencyDepartment } from "@prisma/client";
import { setCourseManagerRole } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

/**
 * Sichtbar/bedienbar nur für den Super-Admin (siehe src/lib/super-admin.ts,
 * setCourseManagerRole) - vergibt die Kursmanager-Zusatzrolle: darf interne
 * Schulungen genau wie der Super-Admin verwalten/bauen, entweder beschränkt
 * auf die hier gewählten Abteilungen oder uneingeschränkt (siehe
 * src/lib/course-manager-access.ts).
 */
export function EditableCourseManager({
  userId,
  isCourseManager,
  allDepartments,
  departments,
}: {
  userId: string;
  isCourseManager: boolean;
  allDepartments: boolean;
  departments: AgencyDepartment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(isCourseManager);
  const [all, setAll] = useState(allDepartments);
  const [selected, setSelected] = useState<AgencyDepartment[]>(departments);
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending);

  function save(nextActive: boolean, nextAll: boolean, nextSelected: AgencyDepartment[]) {
    const prevActive = active;
    const prevAll = all;
    const prevSelected = selected;
    setActive(nextActive);
    setAll(nextAll);
    setSelected(nextSelected);
    startTransition(async () => {
      const result = await setCourseManagerRole(userId, nextActive, nextAll, nextSelected);
      setError(result);
      if (result) {
        setActive(prevActive);
        setAll(prevAll);
        setSelected(prevSelected);
      }
    });
  }

  function toggleDepartment(dep: AgencyDepartment, checked: boolean) {
    const next = checked ? [...selected, dep] : selected.filter((d) => d !== dep);
    save(active, all, next);
  }

  const summary = !active ? "Aus" : all ? "Alle Abteilungen" : selected.length === 0 ? "Keine Abteilung" : selected.map((d) => DEPARTMENT_LABELS[d]).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 min-w-[9rem] justify-between font-normal" disabled={isPending} />
        }
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon className="size-3.5 flex-shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuCheckboxItem
          checked={active}
          onCheckedChange={(checked) => save(checked === true, all, selected)}
          onSelect={(e) => e.preventDefault()}
        >
          Kursmanager aktiv
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Umfang</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={all}
            disabled={!active}
            onCheckedChange={(checked) => save(active, checked === true, selected)}
            onSelect={(e) => e.preventDefault()}
          >
            Alle Abteilungen
          </DropdownMenuCheckboxItem>
          {AGENCY_DEPARTMENTS.map((dep) => (
            <DropdownMenuCheckboxItem
              key={dep}
              checked={selected.includes(dep)}
              disabled={!active || all}
              onCheckedChange={(checked) => toggleDepartment(dep, checked === true)}
              onSelect={(e) => e.preventDefault()}
            >
              {DEPARTMENT_LABELS[dep]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
