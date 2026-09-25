"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloudIcon } from "lucide-react";
import { importSocialPostsCsv } from "@/lib/actions/social-posts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** "Massenimport"/"Bulk-Zeitplan" - single-shot CSV upload, same convention as AddSourceDialog's CSV block for leads. */
export function SocialCsvImportDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [result, formAction, isPending] = useActionState(importSocialPostsCsv, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const isSuccess = result?.includes("importiert");

  useEffect(() => {
    if (wasPending.current && !isPending && result) {
      if (isSuccess) toast.success(result);
      else toast.error(result);
    }
    wasPending.current = isPending;
  }, [isPending, result, isSuccess]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFileName(null);
          formRef.current?.reset();
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <UploadCloudIcon className="size-4" />
        Massenimport (CSV)
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Beiträge per CSV importieren</DialogTitle>
          <DialogDescription>
            Spalten Plattform und Text sind Pflicht; Bild-URL, Veröffentlichung, Kanal und UTM-Kampagne sind optional
            und werden automatisch erkannt (max. 500 Zeilen). Alle importierten Beiträge landen als Entwurf unter
            &bdquo;Idee&ldquo; - Kanal und Zeitplan danach im Board prüfen und freigeben.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="rounded-md border border-input px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
          {fileName && <p className="text-sm text-muted-foreground">Ausgewählt: {fileName}</p>}
          {result && <p className={`text-sm ${isSuccess ? "text-emerald-500" : "text-destructive"}`}>{result}</p>}
          <Button type="submit" disabled={isPending} className="self-end">
            {isPending ? "Importiere..." : "Importieren"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
