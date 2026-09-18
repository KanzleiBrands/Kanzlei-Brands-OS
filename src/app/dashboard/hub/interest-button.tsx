"use client";

import { useActionState } from "react";
import { registerInterest } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";

export function InterestButton({ offerId, ctaLabel, already }: { offerId: string; ctaLabel: string; already: boolean }) {
  const [error, formAction, isPending] = useActionState(registerInterest, undefined);

  if (already) {
    return <p className="text-sm text-green-600">Interesse übermittelt – wir melden uns bei dir.</p>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="offerId" value={offerId} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Wird gesendet..." : ctaLabel}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  );
}
