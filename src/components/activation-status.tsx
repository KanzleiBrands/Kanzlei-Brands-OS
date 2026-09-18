"use client";

import { useState, useTransition } from "react";
import { regenerateActivationLink } from "@/lib/actions/organizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ActivationStatus({
  userId,
  isActive,
  activationLink,
}: {
  userId: string;
  isActive: boolean;
  activationLink: string | null;
}) {
  const [link, setLink] = useState(activationLink);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isActive) {
    return (
      <Badge variant="secondary" className="text-emerald-500">
        Aktiv
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="text-amber-500">
        Ausstehend
      </Badge>
      {link ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Kopiert!" : "Link kopieren"}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-xs"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await regenerateActivationLink(userId);
            if (result?.status === "success") setLink(result.link);
          });
        }}
      >
        {isPending ? "..." : "Neu erstellen"}
      </Button>
    </div>
  );
}
