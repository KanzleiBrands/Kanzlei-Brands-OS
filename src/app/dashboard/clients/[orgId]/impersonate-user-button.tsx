"use client";

import { useTransition } from "react";
import { EyeIcon } from "lucide-react";
import { startImpersonation } from "@/lib/actions/impersonation";
import { Button } from "@/components/ui/button";

export function ImpersonateUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      title={`Als ${userName} ansehen`}
      aria-label={`Als ${userName} ansehen`}
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("userId", userId);
        startTransition(() => {
          startImpersonation(formData);
        });
      }}
    >
      <EyeIcon className="size-4 text-muted-foreground" />
    </Button>
  );
}
