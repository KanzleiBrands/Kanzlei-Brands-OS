"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateLesson } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

export function EditLessonDialog({
  lessonId,
  title,
  description,
  thumbnailUrl,
  videoUrl,
  pdfUrl,
  notionUrl,
}: {
  lessonId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  pdfUrl: string | null;
  notionUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(updateLesson, undefined);
  useSaveToast(error, isPending, "Lektion gespeichert.");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Lektion bearbeiten"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lektion bearbeiten</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <input type="hidden" name="lessonId" value={lessonId} />
          <Input name="title" placeholder="Lektionstitel" defaultValue={title} required />
          <Textarea
            name="description"
            placeholder="Videobeschreibung (optional)"
            rows={3}
            defaultValue={description ?? ""}
          />
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Vorschaubild {thumbnailUrl ? "(ersetzen)" : "(optional)"}
            </label>
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt={title} className="mb-2 h-16 w-28 rounded-md object-cover" />
            )}
            <Input name="thumbnail" type="file" accept="image/*" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Video {videoUrl ? "(ersetzen)" : "(optional)"}
            </label>
            <Input name="video" type="file" accept="video/*" />
          </div>
          <Input name="pdfUrl" placeholder="PDF-Link (optional)" type="url" defaultValue={pdfUrl ?? ""} />
          <Input name="notionUrl" placeholder="Notion-Doc-Link (optional)" type="url" defaultValue={notionUrl ?? ""} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
