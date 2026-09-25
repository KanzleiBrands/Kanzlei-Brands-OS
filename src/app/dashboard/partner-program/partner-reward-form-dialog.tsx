"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { createPartnerReward, updatePartnerReward, uploadPartnerRewardImage } from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

type PartnerRewardData = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string;
  pointsCost: number;
};

export function PartnerRewardFormDialog({ reward }: { reward?: PartnerRewardData }) {
  const isEdit = !!reward;
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(isEdit ? updatePartnerReward : createPartnerReward, undefined);
  useSaveToast(error, isPending, isEdit ? "Prämie gespeichert." : "Prämie angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [imageUrl, setImageUrl] = useState(reward?.imageUrl ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleOpenChange(next: boolean) {
    if (next && !isEdit) {
      formRef.current?.reset();
      setImageUrl("");
      setImageError(null);
    }
    setOpen(next);
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setImageUploading(true);
    setImageError(null);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadPartnerRewardImage(fd);
    setImageUploading(false);
    if ("error" in result) {
      setImageError(result.error);
      return;
    }
    setImageUrl(result.url);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <button type="button" aria-label="Prämie bearbeiten" className="text-muted-foreground hover:text-foreground" />
          ) : (
            <Button type="button" />
          )
        }
      >
        {isEdit ? (
          <PencilIcon className="size-4" />
        ) : (
          <>
            <PlusIcon className="size-4" />
            Prämie anlegen
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Prämie bearbeiten" : "Prämie anlegen"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          {isEdit && <input type="hidden" name="rewardId" value={reward.id} />}
          <input type="hidden" name="imageUrl" value={imageUrl} />

          <Input name="title" placeholder="Titel, z.B. Employer Branding Shooting" required defaultValue={reward?.title} />
          <Textarea name="description" placeholder="Beschreibung" rows={2} defaultValue={reward?.description ?? ""} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Bild</label>
            {imageUrl ? (
              <div className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                {imageUploading ? <Loader2Icon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                {imageUploading ? "Wird hochgeladen..." : "Bild auswählen"}
                <input type="file" accept="image/*" className="hidden" disabled={imageUploading} onChange={(e) => handleImageFile(e.target.files?.[0])} />
              </label>
            )}
            {imageUrl && (
              <div className="flex gap-3">
                <label className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground">
                  Ersetzen
                  <input type="file" accept="image/*" className="hidden" disabled={imageUploading} onChange={(e) => handleImageFile(e.target.files?.[0])} />
                </label>
                <button type="button" className="text-xs text-muted-foreground underline hover:text-destructive" onClick={() => setImageUrl("")}>
                  Entfernen
                </button>
              </div>
            )}
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Kosten in Punkten</label>
              <Input name="pointsCost" type="number" min={1} defaultValue={reward?.pointsCost ?? 1} className="w-24" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Button-Text</label>
              <Input name="ctaLabel" placeholder="Standard: Prämien-Punkte einlösen" defaultValue={reward?.ctaLabel} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : isEdit ? "Speichern" : "Prämie anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
