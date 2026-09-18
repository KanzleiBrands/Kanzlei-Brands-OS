"use client";

import { useActionState, useState } from "react";
import { createOrgUser } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewUserForm({ organizationId, canAssignAdmin }: { organizationId: string; canAssignAdmin: boolean }) {
  const [result, formAction, isPending] = useActionState(createOrgUser, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <Input name="name" placeholder="Name" required />
        <Input name="email" type="email" placeholder="E-Mail" required />
        {canAssignAdmin ? (
          <Select name="role" defaultValue="CLIENT_STAFF">
            <SelectTrigger>
              <SelectValue>
                {(value: string) => (value === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLIENT_STAFF">Mitarbeiter</SelectItem>
              <SelectItem value="CLIENT_ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <input type="hidden" name="role" value="CLIENT_STAFF" />
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird angelegt..." : "Hinzufügen"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Der neue Zugang wird per Aktivierungslink eingeladen &ndash; kein Passwort nötig.
      </p>

      {result?.status === "error" && <p className="text-sm text-destructive">{result.message}</p>}

      {result?.status === "success" && (
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
      )}
    </div>
  );
}
