"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { finalizeLinkedInConnection } from "@/lib/actions/linkedin-social";

type Organization = { urn: string; name: string };

export function LinkedInConnectWizard({
  organizationId,
  organizations,
}: {
  organizationId: string;
  organizations: Organization[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await finalizeLinkedInConnection(organizationId, selected.urn, selected.name);
        router.push(`/dashboard/clients/${organizationId}?tab=content&linkedInConnected=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen.");
      }
    });
  }

  if (organizations.length === 0) {
    return (
      <p className="text-muted-foreground">
        Keine LinkedIn-Unternehmensseiten gefunden, für die du Administrator bist.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {organizations.map((org) => (
          <Button
            key={org.urn}
            type="button"
            variant={selected?.urn === org.urn ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected(org)}
          >
            {org.name}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" disabled={!selected || isPending} onClick={handleConfirm} className="self-start">
        {isPending ? "Verbinde..." : "Verbinden"}
      </Button>
    </div>
  );
}
