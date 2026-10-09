"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { finalizePersonalLinkedInConnection } from "@/lib/actions/linkedin-social";

export function LinkedInPersonalConnectConfirm({
  organizationId,
  personUrn,
  personName,
}: {
  organizationId: string;
  personUrn: string;
  personName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await finalizePersonalLinkedInConnection(organizationId, personUrn, personName);
        router.push(`/dashboard/clients/${organizationId}?tab=content&linkedInConnected=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Angemeldet als <span className="font-medium">{personName}</span>.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={isPending} onClick={handleConfirm} className="self-start">
        {isPending ? "Verbinde..." : `Als ${personName} verbinden`}
      </Button>
    </div>
  );
}
