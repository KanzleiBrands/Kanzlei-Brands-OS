"use client";

import { useTransition } from "react";
import { toggleOfferActive } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";

export function OfferActiveToggle({ offerId, active }: { offerId: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("offerId", offerId);
        startTransition(() => {
          toggleOfferActive(formData);
        });
      }}
    >
      {active ? "Aktiv" : "Inaktiv"}
    </Button>
  );
}
