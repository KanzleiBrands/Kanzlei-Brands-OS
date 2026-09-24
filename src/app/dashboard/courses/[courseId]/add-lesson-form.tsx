"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createLesson } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { LessonVideoUpload } from "./lesson-video-upload";
import { ThumbnailGenerator } from "../thumbnail-generator";

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [titleValue, setTitleValue] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const wasPending = useRef(false);
  const [error, formAction, isPending] = useActionState(createLesson, undefined);
  useSaveToast(error, isPending, "Lektion hinzugefügt.");

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setFormKey((k) => k + 1);
      setTitleValue("");
      setGeneratedPreview(null);
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <PlusIcon className="size-4" />
        Lektion hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lektion hinzufügen</DialogTitle>
        </DialogHeader>

        <form key={formKey} ref={formRef} action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <input type="hidden" name="moduleId" value={moduleId} />
          <Input
            name="title"
            placeholder="Lektionstitel"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Textarea name="description" placeholder="Videobeschreibung (optional)" rows={3} />
          <div className="flex flex-col gap-2">
            <label className="block text-sm text-muted-foreground">Vorschaubild (optional)</label>
            {generatedPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={generatedPreview} alt="Generiertes Vorschaubild" className="h-16 w-28 rounded-md object-cover" />
            )}
            <Input
              ref={thumbnailInputRef}
              name="thumbnail"
              type="file"
              accept="image/*"
              onChange={() => setGeneratedPreview(null)}
            />
            <ThumbnailGenerator seedTitle={titleValue} fileInputRef={thumbnailInputRef} onGenerate={setGeneratedPreview} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Video (optional)</label>
            <LessonVideoUpload />
          </div>
          <Input name="pdfUrl" placeholder="PDF-Link (optional)" type="url" />
          <Input name="notionUrl" placeholder="Notion-Doc-Link (optional)" type="url" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird hochgeladen..." : "Lektion hinzufügen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
