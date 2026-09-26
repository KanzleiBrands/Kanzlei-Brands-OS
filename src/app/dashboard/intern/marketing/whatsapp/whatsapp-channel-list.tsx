"use client";

import { useTransition } from "react";
import { TriangleAlertIcon, XIcon, MessageCircleIcon } from "lucide-react";
import { disconnectWhatsAppChannel } from "@/lib/actions/whatsapp-channels";
import { Button } from "@/components/ui/button";

type Channel = { id: string; displayName: string; displayPhoneNumber: string; active: boolean };

function DisconnectButton({ channelId }: { channelId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Kanal trennen"
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("WhatsApp-Kanal wirklich trennen?")) return;
        startTransition(() => {
          disconnectWhatsAppChannel(channelId);
        });
      }}
    >
      <XIcon className="size-4" />
    </button>
  );
}

export function WhatsAppChannelList({ channels, canManage }: { channels: Channel[]; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <a href="/api/meta/whatsapp/connect" className="self-start">
          <Button type="button" size="sm" variant="outline">
            WhatsApp verbinden
          </Button>
        </a>
      )}
      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canManage ? "Noch kein WhatsApp-Kanal verbunden." : "Noch kein WhatsApp-Kanal verbunden - ein Agentur-Admin kann das oben einrichten."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm">
              <MessageCircleIcon className="size-4 text-emerald-600" />
              <span>
                {channel.displayName} ({channel.displayPhoneNumber})
              </span>
              {!channel.active && (
                <span title="Verbindung abgelaufen - bitte erneut verbinden">
                  <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
                </span>
              )}
              {canManage && <DisconnectButton channelId={channel.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
