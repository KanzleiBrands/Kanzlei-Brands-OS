"use client";

import { useActionState } from "react";
import { createOffer } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewOfferForm({ organizationId }: { organizationId: string }) {
  const [error, formAction, isPending] = useActionState(createOffer, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Input name="title" placeholder="Titel" required className="max-w-xs" />
      <Input name="description" placeholder="Beschreibung" className="max-w-sm" />
      <Input name="ctaLabel" placeholder="Button-Text (Standard: Interesse)" className="max-w-52" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Angebot anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
