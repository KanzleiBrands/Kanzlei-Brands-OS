"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteUser } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Mitarbeiter löschen"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`"${userName}" wirklich löschen? Der Zugang wird unwiderruflich entfernt.`)) {
          return;
        }
        const formData = new FormData();
        formData.set("userId", userId);
        startTransition(() => {
          deleteUser(formData);
        });
      }}
    >
      <Trash2Icon className="size-4 text-muted-foreground" />
    </Button>
  );
}
