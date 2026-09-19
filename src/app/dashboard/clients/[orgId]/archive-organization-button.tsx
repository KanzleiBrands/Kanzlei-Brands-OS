"use client";

import { useTransition } from "react";
import { archiveOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";

export function ArchiveOrganizationButton({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            `"${organizationName}" archivieren? Der Kunde verschwindet aus der Kunden-Übersicht, alle Daten bleiben erhalten und du kannst ihn jederzeit unter "Archivierte Kunden" wieder reaktivieren.`,
          )
        ) {
          return;
        }
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        startTransition(() => {
          archiveOrganization(formData);
        });
      }}
    >
      {isPending ? "Wird archiviert..." : "Kunde archivieren"}
    </Button>
  );
}
