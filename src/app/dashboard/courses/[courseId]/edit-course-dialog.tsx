"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateCourse } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { ThumbnailGenerator } from "../thumbnail-generator";

const LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };

export function EditCourseDialog({
  courseId,
  title,
  description,
  category,
  thumbnailUrl,
}: {
  courseId: string;
  title: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(updateCourse, undefined);
  useSaveToast(error, isPending, "Kurs gespeichert.");
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
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon className="size-4" />
        Kurs bearbeiten
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kurs bearbeiten</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <input type="hidden" name="courseId" value={courseId} />
          <Input
            name="title"
            placeholder="Kurstitel"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Input name="description" placeholder="Beschreibung (optional)" defaultValue={description ?? ""} />
          <div className="flex flex-col gap-2">
            <label className="block text-sm text-muted-foreground">
              Vorschaubild {thumbnailUrl ? "(ersetzen)" : "(optional)"}
            </label>
            {(generatedPreview || thumbnailUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={generatedPreview ?? thumbnailUrl ?? ""}
                alt={title}
                className="h-20 w-36 rounded-md object-cover"
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
          <Select name="category" defaultValue={category}>
            <SelectTrigger>
              <SelectValue>{(value: string) => LABELS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONBOARDING">Onboarding</SelectItem>
              <SelectItem value="TRAINING">Training</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
