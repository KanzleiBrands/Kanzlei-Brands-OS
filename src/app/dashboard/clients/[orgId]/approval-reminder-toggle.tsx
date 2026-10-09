"use client";

import { useTransition } from "react";
import { toggleSocialApprovalReminder } from "@/lib/actions/content-ideas";
import { Switch } from "@/components/ui/switch";

/**
 * An/Aus für die automatische Freigabe-Erinnerungsmail an den Kunden -
 * defaultet auf aus (siehe CLAUDE.md-Automationsregel), rein agenturseitig.
 */
export function ApprovalReminderToggle({ organizationId, enabled }: { organizationId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2.5 text-sm">
      <Switch
        defaultChecked={enabled}
        disabled={isPending}
        onCheckedChange={() => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          startTransition(() => {
            toggleSocialApprovalReminder(formData);
          });
        }}
      />
      Kunde per Mail erinnern, wenn ein Beitrag zu lange unbearbeitet auf Freigabe wartet
    </label>
  );
}
