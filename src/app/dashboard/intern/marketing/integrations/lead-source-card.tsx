"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyIcon, PlusIcon } from "lucide-react";
import { ensureLeadSourceWebhook } from "@/lib/actions/integrations";

export function LeadSourceCard({
  organizationId,
  label,
  description,
  webhookUrl,
}: {
  organizationId: string;
  label: string;
  description: string;
  webhookUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function create() {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("label", label);
    startTransition(async () => {
      try {
        await ensureLeadSourceWebhook(formData);
        toast.success(`Webhook für ${label} angelegt.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  function copy() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook-URL kopiert.");
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        {!webhookUrl && (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={create}>
            <PlusIcon className="size-4" /> Webhook anlegen
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {webhookUrl && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <code className="flex-1 overflow-x-auto text-xs whitespace-nowrap">{webhookUrl}</code>
          <Button type="button" size="icon" variant="ghost" onClick={copy}>
            <CopyIcon className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
