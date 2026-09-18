"use client";

import { useActionState } from "react";
import { createOrgUser } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewUserForm({ organizationId, canAssignAdmin }: { organizationId: string; canAssignAdmin: boolean }) {
  const [error, formAction, isPending] = useActionState(createOrgUser, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Input name="name" placeholder="Name" required />
      <Input name="email" type="email" placeholder="E-Mail" required />
      <Input name="password" type="password" placeholder="Passwort" required minLength={8} />
      {canAssignAdmin ? (
        <Select name="role" defaultValue="CLIENT_STAFF">
          <SelectTrigger>
            <SelectValue>
              {(value: string) => (value === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENT_STAFF">Mitarbeiter</SelectItem>
            <SelectItem value="CLIENT_ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <input type="hidden" name="role" value="CLIENT_STAFF" />
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Hinzufügen"}
      </Button>
      {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
