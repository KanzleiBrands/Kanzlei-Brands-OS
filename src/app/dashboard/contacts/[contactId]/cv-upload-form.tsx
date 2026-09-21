"use client";

import { useActionState, useRef, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { uploadContactCv } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

const MAX_UPLOAD_BYTES = 9 * 1024 * 1024; // server accepts up to 10MB total request; leave headroom

export function CvUploadForm({ contactId, cvUrl }: { contactId: string; cvUrl: string | null }) {
  const [replacing, setReplacing] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, formData: FormData) => {
    const result = await uploadContactCv(prev, formData);
    if (!result) {
      formRef.current?.reset();
      setReplacing(false);
    }
    return result;
  }, undefined);
  useSaveToast(error, isPending, "Lebenslauf hochgeladen.");

  if (cvUrl && !replacing) {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={cvUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
        >
          <FileTextIcon className="size-4 flex-shrink-0 text-muted-foreground" />
          Lebenslauf öffnen
        </a>
        <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)} className="self-start">
          Ersetzen
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <input
        type="file"
        name="cv"
        accept=".pdf,.doc,.docx,image/*"
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
        {cvUrl && (
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(false)}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
