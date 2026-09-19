"use client";

import { useActionState, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createOrgUser } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewAgencyUserForm({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Mitarbeiter anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agentur-Mitarbeiter anlegen</DialogTitle>
        </DialogHeader>
        <NewAgencyUserFormInner key={formKey} organizationId={organizationId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewAgencyUserFormInner({ organizationId, onDone }: { organizationId: string; onDone: () => void }) {
  const [result, formAction, isPending] = useActionState(createOrgUser, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="role" value="AGENCY_ADMIN" />
        <Input name="name" placeholder="Name" required />
        <Input name="email" type="email" placeholder="E-Mail" required />
        <p className="text-sm text-muted-foreground">
          Der neue Zugang wird per Aktivierungslink eingeladen &ndash; kein Passwort nötig. Hat vollen Zugriff auf
          alle Kunden.
        </p>
        {result?.status === "error" && <p className="text-sm text-destructive">{result.message}</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird angelegt..." : "Hinzufügen"}
        </Button>
      </form>

      {result?.status === "success" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <code className="flex-1 truncate text-xs">{result.link}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Kopiert!" : "Aktivierungslink kopieren"}
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={onDone}>
            Fertig
          </Button>
        </div>
      )}
    </div>
  );
}
