"use client";

import { useTransition } from "react";
import { toggleNotifyOnNewContact } from "@/lib/actions/organizations";
import { Checkbox } from "@/components/ui/checkbox";

export function NotifyNewContactToggle({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        defaultChecked={enabled}
        disabled={isPending}
        onCheckedChange={() => {
          const formData = new FormData();
          formData.set("pipelineId", pipelineId);
          startTransition(() => {
            toggleNotifyOnNewContact(formData);
          });
        }}
      />
      Kunde per E-Mail benachrichtigen, wenn ein neuer Lead/Bewerber eingeht
    </label>
  );
}
