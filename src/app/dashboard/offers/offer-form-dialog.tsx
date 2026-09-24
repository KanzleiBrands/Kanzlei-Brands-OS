"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createOffer, updateOffer, uploadOfferImage } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

type OfferData = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  badge: string | null;
  ctaLabel: string;
  productTag: string | null;
  highlights: string[];
  galleryUrls: string[];
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function SortableGalleryImage({ url, onRemove }: { url: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-1.5 rounded-lg border bg-card p-1.5"
    >
      <button
        type="button"
        aria-label="Verschieben"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-black" style={{ aspectRatio: "16 / 9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-contain" />
      </div>
      <button
        type="button"
        aria-label="Bild entfernen"
        onClick={onRemove}
        className="ml-auto flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

export function OfferFormDialog({ offer }: { offer?: OfferData }) {
  const isEdit = !!offer;
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(isEdit ? updateOffer : createOffer, undefined);
  useSaveToast(error, isPending, isEdit ? "Angebot gespeichert." : "Angebot angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [heroUrl, setHeroUrl] = useState(offer?.imageUrl ?? "");
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);

  const [gallery, setGallery] = useState<{ id: string; url: string }[]>(
    (offer?.galleryUrls ?? []).map((url) => ({ id: newId(), url })),
  );
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [highlights, setHighlights] = useState<string[]>(offer?.highlights ?? []);
  const [highlightDraft, setHighlightDraft] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleOpenChange(next: boolean) {
    if (next && !isEdit) {
      // Reset a create dialog's fields each time it's reopened, so a
      // previous submission's state doesn't linger into the next one.
      formRef.current?.reset();
      setHeroUrl("");
      setHeroError(null);
      setGallery([]);
      setHighlights([]);
      setHighlightDraft("");
    }
    setOpen(next);
  }

  async function handleHeroFile(file: File | undefined) {
    if (!file) return;
    setHeroUploading(true);
    setHeroError(null);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadOfferImage(fd);
    setHeroUploading(false);
    if ("error" in result) {
      setHeroError(result.error);
      return;
    }
    setHeroUrl(result.url);
  }

  async function handleGalleryFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("image", file);
      const result = await uploadOfferImage(fd);
      if (!("error" in result)) {
        setGallery((g) => [...g, { id: newId(), url: result.url }]);
      }
    }
    setGalleryUploading(false);
  }

  function handleGalleryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGallery((g) => {
      const oldIndex = g.findIndex((item) => item.id === active.id);
      const newIndex = g.findIndex((item) => item.id === over.id);
      return arrayMove(g, oldIndex, newIndex);
    });
  }

  function addHighlight() {
    const text = highlightDraft.trim();
    if (!text) return;
    setHighlights((h) => [...h, text]);
    setHighlightDraft("");
  }

  function moveHighlight(index: number, dir: -1 | 1) {
    setHighlights((h) => {
      const target = index + dir;
      if (target < 0 || target >= h.length) return h;
      const next = [...h];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <button type="button" aria-label="Angebot bearbeiten" className="text-muted-foreground hover:text-foreground" />
          ) : (
            <Button type="button" />
          )
        }
      >
        {isEdit ? <PencilIcon className="size-4" /> : (
          <>
            <PlusIcon className="size-4" />
            Angebot anlegen
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Angebot bearbeiten" : "Angebot anlegen"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          {isEdit && <input type="hidden" name="offerId" value={offer.id} />}
          <input type="hidden" name="imageUrl" value={heroUrl} />
          <input type="hidden" name="highlights" value={JSON.stringify(highlights)} />
          <input type="hidden" name="galleryUrls" value={JSON.stringify(gallery.map((g) => g.url))} />

          <Input name="title" placeholder="Titel" required defaultValue={offer?.title} />
          <Textarea name="description" placeholder="Beschreibung" rows={3} defaultValue={offer?.description ?? ""} />
          <Input name="badge" placeholder="Badge, z.B. Neu oder Beliebt (optional)" defaultValue={offer?.badge ?? ""} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Titelbild / Mockup</label>
            {heroUrl ? (
              <div className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroUrl} alt="" className="size-full object-contain" />
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                {heroUploading ? <Loader2Icon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                {heroUploading ? "Wird hochgeladen..." : "Bild auswählen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={heroUploading}
                  onChange={(e) => handleHeroFile(e.target.files?.[0])}
                />
              </label>
            )}
            {heroUrl && (
              <div className="flex gap-3">
                <label className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground">
                  Ersetzen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={heroUploading}
                    onChange={(e) => handleHeroFile(e.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-destructive"
                  onClick={() => setHeroUrl("")}
                >
                  Entfernen
                </button>
              </div>
            )}
            {heroError && <p className="text-xs text-destructive">{heroError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Weitere Mockups / Galerie</label>
              <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
                {galleryUploading ? <Loader2Icon className="size-3.5 animate-spin" /> : <UploadCloudIcon className="size-3.5" />}
                Bilder hinzufügen
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={galleryUploading}
                  onChange={(e) => handleGalleryFiles(e.target.files)}
                />
              </label>
            </div>
            {gallery.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
                <SortableContext items={gallery.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-1.5">
                    {gallery.map((item) => (
                      <SortableGalleryImage
                        key={item.id}
                        url={item.url}
                        onRemove={() => setGallery((g) => g.filter((x) => x.id !== item.id))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Vorteile / Highlights</label>
            {highlights.length > 0 && (
              <div className="flex flex-col gap-1">
                {highlights.map((text, index) => (
                  <div key={index} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-sm">
                    <span className="flex-1">{text}</span>
                    <button
                      type="button"
                      aria-label="Nach oben"
                      disabled={index === 0}
                      onClick={() => moveHighlight(index, -1)}
                      className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUpIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Nach unten"
                      disabled={index === highlights.length - 1}
                      onClick={() => moveHighlight(index, 1)}
                      className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDownIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Entfernen"
                      onClick={() => setHighlights((h) => h.filter((_, i) => i !== index))}
                      className="flex size-6 items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                value={highlightDraft}
                onChange={(e) => setHighlightDraft(e.target.value)}
                placeholder="z.B. Inklusive Support & Anpassungen"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHighlight();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addHighlight}>
                Hinzufügen
              </Button>
            </div>
          </div>

          <Input name="ctaLabel" placeholder="Button-Text (Standard: Interesse)" defaultValue={offer?.ctaLabel} />
          <div className="flex flex-col gap-1">
            <Input name="productTag" placeholder="Produkt-Tag, z.B. webseite (optional)" defaultValue={offer?.productTag ?? ""} />
            <p className="text-xs text-muted-foreground">
              Kunden, bei denen dieser Tag unter &bdquo;Bereits gebuchte Produkte&ldquo; hinterlegt ist, sehen dieses
              Angebot nicht.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : isEdit ? "Speichern" : "Angebot anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
