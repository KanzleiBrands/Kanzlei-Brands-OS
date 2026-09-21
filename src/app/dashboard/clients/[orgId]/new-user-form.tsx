"use client";

import { useActionState, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createOrgUser } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

export function NewUserForm({ organizationId, canAssignAdmin }: { organizationId: string; canAssignAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  // Remount the inner form on every open so a previous invite's activation
  // link/state never lingers into the next one.
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
        Mitarbeiter einladen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mitarbeiter einladen</DialogTitle>
        </DialogHeader>
        <NewUserFormInner
          key={formKey}
          organizationId={organizationId}
          canAssignAdmin={canAssignAdmin}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewUserFormInner({
  organizationId,
  canAssignAdmin,
  onDone,
}: {
  organizationId: string;
  canAssignAdmin: boolean;
  onDone: () => void;
}) {
  const [result, formAction, isPending] = useActionState(createOrgUser, undefined);
  useSaveToast(
    result?.status === "success"
      ? { status: "success", message: "Mitarbeiter eingeladen." }
      : result?.status === "error"
        ? result.message
        : undefined,
    isPending,
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {result?.status !== "success" && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <Input name="name" placeholder="Name" required />
          <Input name="email" type="email" placeholder="E-Mail" required />
          {canAssignAdmin ? (
            <Select name="role" defaultValue="CLIENT_STAFF">
              <SelectTrigger>
                <SelectValue>{(value: string) => (value === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT_STAFF">Mitarbeiter</SelectItem>
                <SelectItem value="CLIENT_ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <input type="hidden" name="role" value="CLIENT_STAFF" />
          )}
          <p className="text-sm text-muted-foreground">
            Der neue Zugang wird per Aktivierungslink eingeladen &ndash; kein Passwort nötig.
          </p>
          {result?.status === "error" && <p className="text-sm text-destructive">{result.message}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Hinzufügen"}
          </Button>
        </form>
      )}

      {result?.status === "success" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{result.link}</code>
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
