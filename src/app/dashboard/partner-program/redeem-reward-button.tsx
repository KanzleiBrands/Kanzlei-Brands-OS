"use client";

import { useActionState } from "react";
import { redeemPartnerReward } from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

export function RedeemRewardButton({
  rewardId,
  ctaLabel,
  affordable,
  missingPoints,
}: {
  rewardId: string;
  ctaLabel: string;
  affordable: boolean;
  missingPoints: number;
}) {
  const [error, formAction, isPending] = useActionState(redeemPartnerReward, undefined);
  useSaveToast(error, isPending, "Prämie eingelöst - wir melden uns bei dir.");

  if (!affordable) {
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
        {isPending ? "Wird eingelöst..." : ctaLabel}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </form>
  );
}
