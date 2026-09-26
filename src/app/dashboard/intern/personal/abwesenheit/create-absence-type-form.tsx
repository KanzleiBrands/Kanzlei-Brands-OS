"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAbsenceType } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ABSENCE_COLOR_OPTIONS } from "@/lib/absence-colors";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AbsenceTypeIcon } from "./absence-type-icon";

const ICON_OPTIONS = ["Sun", "Cross", "Stethoscope", "Home", "Building2", "Wallet", "Plane", "HeartPulse", "Baby", "GraduationCap", "Coffee", "Umbrella", "CalendarDays"];

export function CreateAbsenceTypeForm() {
  const [error, formAction, isPending] = useActionState(createAbsenceType, undefined);
  useSaveToast(error, isPending, "Abwesenheitsart angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [color, setColor] = useState(ABSENCE_COLOR_OPTIONS[0]);
  const [allowanceType, setAllowanceType] = useState<"LIMITED" | "UNLIMITED">("UNLIMITED");
  const [requiresApproval, setRequiresApproval] = useState(true);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setIcon(ICON_OPTIONS[0]);
      setColor(ABSENCE_COLOR_OPTIONS[0]);
      setAllowanceType("UNLIMITED");
      setRequiresApproval(true);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="z.B. Sonderurlaub" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Icon</Label>
        <Select name="icon" value={icon} onValueChange={(v) => v && setIcon(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {() => (
                <span className="flex items-center gap-2">
                  <AbsenceTypeIcon icon={icon} color={color} className="size-3.5" />
                  {icon}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Farbe</Label>
        <Select name="color" value={color} onValueChange={(v) => v && setColor(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>{() => color}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ABSENCE_COLOR_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Kontingent-Typ</Label>
        <Select name="allowanceType" value={allowanceType} onValueChange={(v) => v && setAllowanceType(v as "LIMITED" | "UNLIMITED")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => (v === "LIMITED" ? "Jahres-Kontingent" : "Unbegrenzt")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UNLIMITED">Unbegrenzt</SelectItem>
            <SelectItem value="LIMITED">Jahres-Kontingent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {allowanceType === "LIMITED" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="defaultAnnualDays">Standard-Kontingent (Tage/Jahr)</Label>
          <Input id="defaultAnnualDays" name="defaultAnnualDays" type="number" min={0} defaultValue={30} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weeklyCapDays">Max. Tage/Woche (optional)</Label>
        <Input id="weeklyCapDays" name="weeklyCapDays" type="number" min={0} placeholder="z.B. 2 bei Homeoffice" />
      </div>

      <div className="flex items-center gap-2 sm:col-span-2">
        <input type="hidden" name="requiresApproval" value={requiresApproval ? "true" : "false"} />
        <Checkbox checked={requiresApproval} onCheckedChange={(checked) => setRequiresApproval(checked === true)} />
        <Label>Genehmigungspflichtig</Label>
      </div>

      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-fit sm:col-span-2">
        {isPending ? "Wird angelegt..." : "Abwesenheitsart anlegen"}
      </Button>
    </form>
  );
}
