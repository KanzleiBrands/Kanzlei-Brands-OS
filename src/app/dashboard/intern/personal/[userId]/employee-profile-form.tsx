"use client";

import { useActionState, useState } from "react";
import { updateEmployeeProfile } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

const NONE = "__none__";

function toInputDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function EmployeeProfileForm({
  userId,
  position,
  location,
  department,
  managerId,
  birthday,
  hireDate,
  active,
  managerCandidates,
}: {
  userId: string;
  position: string | null;
  location: string | null;
  department: string | null;
  managerId: string | null;
  birthday: Date | null;
  hireDate: Date | null;
  active: boolean;
  managerCandidates: { id: string; name: string }[];
}) {
  const [error, formAction, isPending] = useActionState(updateEmployeeProfile, undefined);
  useSaveToast(error, isPending, "Profil gespeichert.");
  const [isActive, setIsActive] = useState(active);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="position">Position</Label>
        <Input id="position" name="position" defaultValue={position ?? ""} placeholder="z.B. Online Marketing Manager" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Standort</Label>
        <Input id="location" name="location" defaultValue={location ?? ""} placeholder="z.B. Hamburg" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Gruppe / Abteilung</Label>
        <Select name="department" defaultValue={department ?? NONE}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value: string) => (value === NONE ? "Keine Gruppe" : DEPARTMENT_LABELS[value as keyof typeof DEPARTMENT_LABELS])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Keine Gruppe</SelectItem>
            {AGENCY_DEPARTMENTS.map((dep) => (
              <SelectItem key={dep} value={dep}>
                {DEPARTMENT_LABELS[dep]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Manager*in</Label>
        <Select name="managerId" defaultValue={managerId ?? NONE}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value: string) => (value === NONE ? "Kein*e Manager*in" : managerCandidates.find((m) => m.id === value)?.name ?? "?")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Kein*e Manager*in</SelectItem>
            {managerCandidates
              .filter((m) => m.id !== userId)
              .map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birthday">Geburtstag</Label>
        <Input id="birthday" name="birthday" type="date" defaultValue={toInputDate(birthday)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hireDate">Unternehmensbeitritt</Label>
        <Input id="hireDate" name="hireDate" type="date" defaultValue={toInputDate(hireDate)} />
      </div>

      <div className="flex items-center gap-2 sm:col-span-2">
        <input type="hidden" name="active" value={isActive ? "true" : "false"} />
        <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
        <Label>Aktiv beschäftigt</Label>
      </div>

      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

      <Button type="submit" disabled={isPending} className="sm:col-span-2 sm:w-fit">
        {isPending ? "Wird gespeichert..." : "Speichern"}
      </Button>
    </form>
  );
}
