"use client";

import { useTransition } from "react";
import { RadioIcon } from "lucide-react";
import { setOffersSectionEnabled } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";

export function OffersSectionToggle({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <RadioIcon className={`size-5 shrink-0 ${enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{enabled ? "Angebote sind live für Kunden" : "Angebote sind für Kunden ausgeblendet"}</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Alle aktiven Angebote werden im Kunden-Hub angezeigt."
            : "Kunden sehen die Angebote-Sektion im Kunden-Hub nicht, bis du sie hier live schaltest."}
        </p>
      </div>
      <Button
        type="button"
        variant={enabled ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={() => {
          const formData = new FormData();
          formData.set("enabled", enabled ? "" : "1");
          startTransition(() => {
            setOffersSectionEnabled(formData);
          });
        }}
      >
        {enabled ? "Für Kunden ausblenden" : "Jetzt für Kunden live schalten"}
      </Button>
    </div>
  );
}
