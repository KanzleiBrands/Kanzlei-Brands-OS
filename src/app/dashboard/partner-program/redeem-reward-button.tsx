"use client";

import { useActionState } from "react";
import { redeemPartnerReward } from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

export function RedeemRewardButton({
  rewardId,
  ctaLabel,
  pointsCost,
  balance,
}: {
  rewardId: string;
  ctaLabel: string;
  pointsCost: number | null;
  balance: number;
}) {
  const [error, formAction, isPending] = useActionState(redeemPartnerReward, undefined);
  useSaveToast(
    error,
    isPending,
    pointsCost == null ? "Anfrage an euren Account-Manager gesendet." : "Prämie eingelöst - wir melden uns bei dir.",
  );

  if (pointsCost != null && balance < pointsCost) {
    const missingPoints = pointsCost - balance;
    return (
      <Button type="button" size="sm" disabled variant="outline">
        Noch {missingPoints} Punkt{missingPoints === 1 ? "" : "e"} nötig
      </Button>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="rewardId" value={rewardId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Wird gesendet..." : ctaLabel}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </form>
  );
}
