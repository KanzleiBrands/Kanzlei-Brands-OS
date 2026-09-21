"use client";

import { useActionState, useRef, useState } from "react";
import { updateAvatar } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { useSaveToast } from "@/hooks/use-save-toast";

const MAX_UPLOAD_BYTES = 9 * 1024 * 1024; // server accepts up to 10MB total request; leave headroom

export function AvatarUploadForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [replacing, setReplacing] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, formData: FormData) => {
    const result = await updateAvatar(prev, formData);
    if (!result) {
      formRef.current?.reset();
      setReplacing(false);
    }
    return result;
  }, undefined);
  useSaveToast(error, isPending, "Profilbild aktualisiert.");

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.at(-1) ?? null;

  const preview = (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="size-14 rounded-full object-cover" />
      ) : (
        <div
          className="flex size-14 items-center justify-center rounded-full text-lg font-medium text-white"
          style={{ backgroundColor: avatarColorFor(name) }}
        >
          {initialsOf(firstName ?? null, lastName)}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Wird angezeigt, wenn du als Account Manager oder Buchhaltungs-Ansprechpartner in einem Kunden-Hub hinterlegt
        bist.
      </p>
    </div>
  );

  if (avatarUrl && !replacing) {
    return (
      <div className="flex flex-col gap-3">
        {preview}
        <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)} className="self-start">
          Bild ändern
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {preview}
      <input
        type="file"
        name="avatar"
        accept="image/*"
        required
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.size > MAX_UPLOAD_BYTES) {
            setSizeError(`Datei ist zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximal 9 MB.`);
            e.target.value = "";
          } else {
            setSizeError(null);
          }
        }}
        className="rounded-md border border-input px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
      />
      {sizeError && <p className="text-sm text-destructive">{sizeError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending} className="self-start">
          {isPending ? "Wird hochgeladen..." : "Hochladen"}
        </Button>
        {avatarUrl && (
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(false)}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
