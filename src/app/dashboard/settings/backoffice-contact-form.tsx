"use client";

import { useActionState } from "react";
import { updatePortalBackofficeContact } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AgencyUser = { id: string; name: string };

export function BackofficeContactForm({
  backofficeContactId,
  agencyUsers,
}: {
  backofficeContactId: string | null;
  agencyUsers: AgencyUser[];
}) {
  const [error, formAction, isPending] = useActionState(updatePortalBackofficeContact, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select name="backofficeContactId" defaultValue={backofficeContactId ?? ""}>
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
