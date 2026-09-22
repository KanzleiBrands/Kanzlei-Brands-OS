"use client";

import { useActionState } from "react";
import { updateEmailSignature } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

export function SignatureForm({ defaultValue }: { defaultValue: string }) {
  const [result, formAction, isPending] = useActionState(updateEmailSignature, undefined);
  useSaveToast(
    result?.status === "success"
      ? { status: "success", message: result.message }
      : result?.status === "error"
        ? result.message
        : undefined,
    isPending,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="signature"
        placeholder={"Viele Grüße\nDein Name\nKanzlei Brands"}
        defaultValue={defaultValue}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {result?.status === "error" && <p className="text-sm text-destructive">{result.message}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Wird gespeichert..." : "Signatur speichern"}
      </Button>
    </form>
  );
}
