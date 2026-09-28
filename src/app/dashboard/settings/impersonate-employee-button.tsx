"use client";

import { useTransition } from "react";
import { EyeIcon } from "lucide-react";
import { startEmployeeImpersonation } from "@/lib/actions/impersonation";
import { Button } from "@/components/ui/button";

export function ImpersonateEmployeeButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      title={`Als ${userName} anmelden`}
      aria-label={`Als ${userName} anmelden`}
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("userId", userId);
        startTransition(() => {
          startEmployeeImpersonation(formData);
        });
      }}
    >
      <EyeIcon className="size-4 text-muted-foreground" />
    </Button>
  );
}
