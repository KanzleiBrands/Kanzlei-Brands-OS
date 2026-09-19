"use client";

import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { deleteAdditionalContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";

export function RemoveAdditionalContactButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      aria-label="Kontakt entfernen"
      onClick={() => {
        const formData = new FormData();
        formData.set("id", id);
        startTransition(() => {
          deleteAdditionalContact(formData);
        });
      }}
    >
      <XIcon className="size-4 text-muted-foreground hover:text-destructive" />
    </Button>
  );
}
