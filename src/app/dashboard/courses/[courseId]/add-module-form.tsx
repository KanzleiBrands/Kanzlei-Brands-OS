"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createModule } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { ThumbnailGenerator } from "../thumbnail-generator";

export function AddModuleForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createModule, undefined);
  useSaveToast(error, isPending, "Modul angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [titleValue, setTitleValue] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setTitleValue("");
      setGeneratedPreview(null);
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        <PlusIcon className="size-4" />
        Modul hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modul hinzufügen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <input type="hidden" name="courseId" value={courseId} />
          <Input
            name="title"
            placeholder="Modultitel (z.B. Theoretische Grundlagen)"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Textarea name="description" placeholder="Beschreibung (optional)" rows={2} />
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Modul hinzufügen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
