"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyIcon, WandSparklesIcon } from "lucide-react";
import { setupCalendlyWebhook } from "@/lib/actions/integrations";

export function CalendlySetupButton() {
  const [isPending, startTransition] = useTransition();
  const [signingKey, setSigningKey] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      try {
        const result = await setupCalendlyWebhook();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (!result.created) {
          toast.success("Webhook existiert bereits und ist aktiv - nichts zu tun.");
          return;
        }
        setSigningKey(result.signingKey);
        toast.success("Webhook angelegt - Signing-Key jetzt in Vercel eintragen!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  function copy() {
    if (!signingKey) return;
    navigator.clipboard.writeText(signingKey);
    toast.success("Signing-Key kopiert.");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={run}>
        <WandSparklesIcon className="size-4" />
        Calendly-Webhook automatisch einrichten
      </Button>
      {signingKey && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Jetzt als <code>CALENDLY_WEBHOOK_SIGNING_KEY</code> in Vercel eintragen - wird nur dieses eine Mal angezeigt.
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-background p-2">
            <code className="flex-1 overflow-x-auto text-xs whitespace-nowrap">{signingKey}</code>
            <Button type="button" size="icon" variant="ghost" onClick={copy}>
              <CopyIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
