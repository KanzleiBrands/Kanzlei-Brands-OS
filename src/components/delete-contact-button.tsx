"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";

export function DeleteContactButton({
  contactId,
  contactName,
  redirectTo,
  variant = "icon",
}: {
  contactId: string;
  contactName: string;
  redirectTo?: string;
  variant?: "icon" | "full";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm(`"${contactName || "Kontakt"}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    const formData = new FormData();
    formData.set("contactId", contactId);
    startTransition(async () => {
      await deleteContact(formData);
      if (redirectTo) router.push(redirectTo);
    });
  }

  if (variant === "full") {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
      >
        {isPending ? "Wird gelöscht..." : "Kontakt löschen"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      }}
      aria-label="Kontakt löschen"
    >
      <Trash2Icon className="size-4 text-muted-foreground hover:text-destructive" />
    </Button>
  );
}
