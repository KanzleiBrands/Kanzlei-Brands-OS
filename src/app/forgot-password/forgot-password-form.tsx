"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [result, formAction, isPending] = useActionState(requestPasswordReset, undefined);

  if (result?.status === "success") {
    return <p className="text-center text-sm text-emerald-500">{result.message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
      </div>
      {result?.status === "error" && <p className="text-sm text-destructive">{result.message}</p>}
      <Button type="submit" disabled={isPending} className="h-11 w-full text-base">
        {isPending ? "Wird gesendet..." : "Link zum Zurücksetzen senden"}
      </Button>
    </form>
  );
}
