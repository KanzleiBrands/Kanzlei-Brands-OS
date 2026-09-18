"use client";

import { useActionState } from "react";
import { createClientOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewClientForm() {
  const [error, formAction, isPending] = useActionState(createClientOrganization, undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <Input name="name" placeholder="Name des Kunden" required className="max-w-xs" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Kunde anlegen"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
