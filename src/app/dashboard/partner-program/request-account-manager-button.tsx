"use client";

import { useActionState } from "react";
import { requestPartnerAction } from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

export function RequestAccountManagerButton({ actionId, ctaLabel }: { actionId: string; ctaLabel: string }) {
  const [error, formAction, isPending] = useActionState(requestPartnerAction, undefined);
  useSaveToast(error, isPending, "Anfrage an euren Account-Manager gesendet.");

  return (
    <form action={formAction}>
      <input type="hidden" name="actionId" value={actionId} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Wird gesendet..." : ctaLabel}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  );
}
