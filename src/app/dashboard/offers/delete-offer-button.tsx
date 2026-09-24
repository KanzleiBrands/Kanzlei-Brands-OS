"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteOffer } from "@/lib/actions/offers";

export function DeleteOfferButton({ offerId, offerTitle }: { offerId: string; offerTitle: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Angebot löschen"
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!window.confirm(`"${offerTitle}" wirklich löschen?`)) return;
        const formData = new FormData();
        formData.set("offerId", offerId);
        startTransition(() => {
          deleteOffer(undefined, formData);
        });
      }}
    >
      <Trash2Icon className="size-4" />
    </button>
  );
}
