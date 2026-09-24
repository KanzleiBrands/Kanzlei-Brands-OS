"use client";

import { useTransition } from "react";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import { disconnectSocialChannel } from "@/lib/actions/social-channels";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icon";

type Channel = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  displayName: string;
  active: boolean;
};

function DisconnectButton({ channelId }: { channelId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Kanal trennen"
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Kanal wirklich trennen? Geplante Beiträge können dann nicht mehr veröffentlicht werden.")) return;
        const formData = new FormData();
        formData.set("channelId", channelId);
        startTransition(() => {
          disconnectSocialChannel(channelId);
        });
      }}
    >
      <XIcon className="size-4" />
    </button>
  );
}

export function SocialChannelList({ organizationId, channels }: { organizationId: string; channels: Channel[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Kanäle</p>
        <div className="flex flex-wrap gap-1.5">
          <a href={`/api/meta/social/connect?organizationId=${organizationId}`}>
            <Button type="button" size="sm" variant="outline">
              Facebook/Instagram verbinden
            </Button>
          </a>
          <a href={`/api/linkedin/connect?organizationId=${organizationId}`}>
            <Button type="button" size="sm" variant="outline">
              LinkedIn verbinden
            </Button>
          </a>
        </div>
      </div>
      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch kein Kanal verbunden.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => {
            return (
              <div
                key={channel.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm"
              >
                <PlatformIcon platform={channel.platform} />
                <span>{channel.displayName}</span>
                {!channel.active && (
                  <span title="Verbindung abgelaufen - bitte erneut verbinden">
                    <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
                  </span>
                )}
                <DisconnectButton channelId={channel.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
