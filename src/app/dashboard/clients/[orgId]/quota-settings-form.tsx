"use client";

import { useActionState } from "react";
import { updateOrganizationQuotas } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function QuotaSettingsForm({
  organizationId,
  leadsQuota,
  applicantsQuota,
  leadsUsed,
  applicantsUsed,
}: {
  organizationId: string;
  leadsQuota: number | null;
  applicantsQuota: number | null;
  leadsUsed: number;
  applicantsUsed: number;
}) {
  const [error, formAction, isPending] = useActionState(updateOrganizationQuotas, undefined);
  useSaveToast(error, isPending);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="leadsQuota" className="text-sm text-muted-foreground">
          Gebuchte Mandatsakquise-Kampagnen ({leadsUsed} in Gebrauch)
        </label>
        <Input
          id="leadsQuota"
          name="leadsQuota"
          type="number"
          min={0}
          step={1}
          placeholder="Kein Limit"
          defaultValue={leadsQuota ?? ""}
          className="max-w-40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="applicantsQuota" className="text-sm text-muted-foreground">
          Gebuchte Recruiting-Kampagnen ({applicantsUsed} in Gebrauch)
        </label>
        <Input
          id="applicantsQuota"
          name="applicantsQuota"
          type="number"
          min={0}
          step={1}
          placeholder="Kein Limit"
          defaultValue={applicantsQuota ?? ""}
          className="max-w-40"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
