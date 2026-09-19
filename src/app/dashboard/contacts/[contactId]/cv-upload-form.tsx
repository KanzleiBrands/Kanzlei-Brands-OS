"use client";

import { useActionState, useRef } from "react";
import { FileTextIcon } from "lucide-react";
import { uploadContactCv } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";

export function CvUploadForm({ contactId, cvUrl }: { contactId: string; cvUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, formData: FormData) => {
    const result = await uploadContactCv(prev, formData);
    if (!result) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <div className="flex flex-col gap-3">
      {cvUrl && (
        <a
          href={cvUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-primary underline"
        >
          <FileTextIcon className="size-4" />
          Lebenslauf ansehen
        </a>
      )}
      <form ref={formRef} action={formAction} className="flex flex-col gap-2" encType="multipart/form-data">
        <input type="hidden" name="contactId" value={contactId} />
        <input
          type="file"
          name="cv"
          accept=".pdf,.doc,.docx,image/*"
          required
          className="rounded-md border border-input px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={isPending} className="self-start">
          {isPending ? "Wird hochgeladen..." : cvUrl ? "Ersetzen" : "Hochladen"}
        </Button>
      </form>
    </div>
  );
}
