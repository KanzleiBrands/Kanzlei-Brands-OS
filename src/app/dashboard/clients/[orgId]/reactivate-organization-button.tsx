"use client";

import { useTransition } from "react";
import { reactivateOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";

export function ReactivateOrganizationButton({ organizationId }: { organizationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        startTransition(() => {
          reactivateOrganization(formData);
        });
      }}
    >
      {isPending ? "Wird reaktiviert..." : "Reaktivieren"}
    </Button>
  );
}
