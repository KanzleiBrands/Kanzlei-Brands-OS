"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveToast } from "@/hooks/use-save-toast";

export function ChangePasswordForm() {
  const [result, formAction, isPending] = useActionState(changePassword, undefined);
  useSaveToast(result, isPending);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {result && (
        <p className={`text-sm ${result.status === "error" ? "text-destructive" : "text-green-500"}`}>
          {result.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Wird geändert..." : "Passwort ändern"}
      </Button>
    </form>
  );
}
