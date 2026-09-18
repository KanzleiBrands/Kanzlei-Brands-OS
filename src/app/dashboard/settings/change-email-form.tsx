"use client";

import { useActionState } from "react";
import { changeEmail } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [result, formAction, isPending] = useActionState(changeEmail, undefined);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newEmail">Neue E-Mail-Adresse</Label>
        <Input id="newEmail" name="newEmail" type="email" defaultValue={currentEmail} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPasswordForEmail">Passwort zur Bestätigung</Label>
        <Input id="currentPasswordForEmail" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      {result && (
        <p className={`text-sm ${result.status === "error" ? "text-destructive" : "text-green-500"}`}>
          {result.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Wird geändert..." : "E-Mail ändern"}
      </Button>
      <p className="text-xs text-muted-foreground">Nach der Änderung wirst du abgemeldet und musst dich neu anmelden.</p>
    </form>
  );
}
