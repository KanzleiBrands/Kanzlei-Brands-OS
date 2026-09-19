"use client";

import { useActionState } from "react";
import { updateOrganizationIntakeSettings } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AgencyUser = { id: string; name: string };

export function IntakeSettingsForm({
  organizationId,
  accountManagerId,
  leadsFormUrl,
  applicantsFormUrl,
  agencyUsers,
}: {
  organizationId: string;
  accountManagerId: string | null;
  leadsFormUrl: string | null;
  applicantsFormUrl: string | null;
  agencyUsers: AgencyUser[];
}) {
  const [error, formAction, isPending] = useActionState(updateOrganizationIntakeSettings, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">Account Manager</label>
        <Select name="accountManagerId" defaultValue={accountManagerId ?? ""}>
          <SelectTrigger className="max-w-64">
            <SelectValue>
              {(value: string) => agencyUsers.find((u) => u.id === value)?.name ?? "Nicht zugewiesen"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {agencyUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Bekommt eine Anfrage, wenn dieser Kunde weitere Kontingente beauftragen möchte. Ohne Zuweisung geht die
          Anfrage an alle Agentur-Admins.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="leadsFormUrl" className="text-sm text-muted-foreground">
          Mandatsakquise-Briefing (Jotform-URL)
        </label>
        <Input
          id="leadsFormUrl"
          name="leadsFormUrl"
          type="url"
          placeholder="https://form.jotform.com/..."
          defaultValue={leadsFormUrl ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="applicantsFormUrl" className="text-sm text-muted-foreground">
          Stellenformular (Jotform-URL)
        </label>
        <Input
          id="applicantsFormUrl"
          name="applicantsFormUrl"
          type="url"
          placeholder="https://form.jotform.com/..."
          defaultValue={applicantsFormUrl ?? ""}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
