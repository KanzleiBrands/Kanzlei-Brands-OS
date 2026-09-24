"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateModule } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { ThumbnailGenerator } from "../thumbnail-generator";

export function EditModuleDialog({
  moduleId,
  title,
  description,
  thumbnailUrl,
}: {
  moduleId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(updateModule, undefined);
  useSaveToast(error, isPending, "Modul gespeichert.");
  const wasPending = useRef(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [titleValue, setTitleValue] = useState(title);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setTitleValue(title);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button type="button" aria-label="Modul bearbeiten" className="text-muted-foreground hover:text-foreground" />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modul bearbeiten</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <input type="hidden" name="moduleId" value={moduleId} />
          <Input
            name="title"
            placeholder="Modultitel"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Textarea name="description" placeholder="Beschreibung (optional)" rows={2} defaultValue={description ?? ""} />
          <div className="flex flex-col gap-2">
            <label className="block text-sm text-muted-foreground">
              Vorschaubild {thumbnailUrl ? "(ersetzen)" : "(optional)"}
            </label>
            {(generatedPreview || thumbnailUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={generatedPreview ?? thumbnailUrl ?? ""}
                alt={title}
                className="h-16 w-28 rounded-md object-cover"
              />
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
