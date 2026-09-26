"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createCourse } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { ThumbnailGenerator } from "./thumbnail-generator";

const LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };
const AUDIENCE_LABELS: Record<string, string> = { CLIENT: "Kunden", INTERNAL: "Mitarbeiter (internes Portal)" };

export function NewCourseForm() {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createCourse, undefined);
  useSaveToast(error, isPending, "Kurs angelegt.");
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
        Kurs anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kurs anlegen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
          <Input
            name="title"
            placeholder="Kurstitel"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Input name="description" placeholder="Beschreibung (optional)" />
          <div className="flex flex-col gap-2">
            <label className="block text-sm text-muted-foreground">Vorschaubild (optional)</label>
            {generatedPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={generatedPreview} alt="Generiertes Vorschaubild" className="h-20 w-36 rounded-md object-cover" />
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
          <Select name="category" defaultValue="TRAINING">
            <SelectTrigger>
              <SelectValue>{(value: string) => LABELS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONBOARDING">Onboarding</SelectItem>
              <SelectItem value="TRAINING">Training</SelectItem>
            </SelectContent>
          </Select>
          <Select name="audience" defaultValue="CLIENT">
            <SelectTrigger>
              <SelectValue>{(value: string) => AUDIENCE_LABELS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLIENT">{AUDIENCE_LABELS.CLIENT}</SelectItem>
              <SelectItem value="INTERNAL">{AUDIENCE_LABELS.INTERNAL}</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Kurs anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
