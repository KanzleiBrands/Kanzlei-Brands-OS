"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { createListWebhook, deleteListWebhook, deleteMarketingTag } from "@/lib/actions/marketing-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { absenceColorHex } from "@/lib/absence-colors";

type Tag = {
  id: string;
  name: string;
  color: string;
  subscriberCount: number;
  funnelCount: number;
  webhook: { id: string; url: string } | null;
};

export function TagRow({ tag, canManage }: { tag: Tag; canManage: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: absenceColorHex(tag.color) }} />
        <p className="font-medium">{tag.name}</p>
        <Badge variant="secondary">{tag.subscriberCount} Kontakt(e)</Badge>
        {tag.funnelCount > 0 && <Badge variant="secondary">{tag.funnelCount} Funnel-Trigger</Badge>}
        {canManage && (
          <button
            type="button"
            aria-label="Tag löschen"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm(`Tag "${tag.name}" wirklich löschen? Der Webhook wird mit gelöscht.`)) return;
              const fd = new FormData();
              fd.set("tagId", tag.id);
              startTransition(() => deleteMarketingTag(fd));
            }}
            className="ml-auto flex size-7 items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>

      {canManage &&
        (tag.webhook ? (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{tag.webhook.url}</code>
            <button
              type="button"
              aria-label="Webhook-URL kopieren"
              onClick={() => copyUrl(tag.webhook!.url)}
              className="flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Webhook löschen"
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("webhookId", tag.webhook!.id);
                startTransition(() => deleteListWebhook(fd));
              }}
              className="flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={isPending}
            onClick={() => {
              const fd = new FormData();
              fd.set("tagId", tag.id);
              startTransition(() => {
                createListWebhook(undefined, fd);
              });
            }}
          >
            Webhook erzeugen
          </Button>
        ))}
    </div>
  );
}
