"use client";

import { useActionState } from "react";
import { updateContactInfo } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContactInfoForm({ phone, calendlyUrl }: { phone: string | null; calendlyUrl: string | null }) {
  const [, formAction, isPending] = useActionState(updateContactInfo, undefined);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Telefonnummer</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+49 30 12345678" defaultValue={phone ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="calendlyUrl">Calendly-Terminlink</Label>
        <Input
          id="calendlyUrl"
          name="calendlyUrl"
          type="url"
          placeholder="https://calendly.com/dein-name"
          defaultValue={calendlyUrl ?? ""}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Wird angezeigt, wenn du als Account Manager oder Buchhaltungs-Ansprechpartner in einem Kunden-Hub hinterlegt
        bist.
      </p>
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
