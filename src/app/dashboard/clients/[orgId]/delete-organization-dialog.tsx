"use client";

import { useState, useTransition } from "react";
import { deleteOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteOrganizationDialog({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const canConfirm = confirmText === organizationName;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger render={<Button type="button" variant="destructive" />}>Kunde löschen</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kunde unwiderruflich löschen</DialogTitle>
          <DialogDescription>
            Damit werden {organizationName} sowie alle zugehörigen Kampagnen, Kontakte, Mitarbeiter und Lead-Quellen
            endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-org-name" className="text-sm text-muted-foreground">
            Gib zur Bestätigung <span className="font-medium text-foreground">{organizationName}</span> ein:
          </label>
          <Input
            id="confirm-org-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("organizationId", organizationId);
              startTransition(() => {
                deleteOrganization(formData);
              });
            }}
          >
            {isPending ? "Wird gelöscht..." : "Endgültig löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
