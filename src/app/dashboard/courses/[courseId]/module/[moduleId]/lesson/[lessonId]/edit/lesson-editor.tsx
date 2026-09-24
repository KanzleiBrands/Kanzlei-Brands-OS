"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  GripVerticalIcon,
  HeadingIcon,
  ImageIcon,
  Loader2Icon,
  PilcrowIcon,
  TrashIcon,
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
import { updateLesson, uploadLessonBlockImage } from "@/lib/actions/courses";
import type { LessonBlock } from "@/lib/lesson-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";
import { LessonVideoUpload } from "../../../../../lesson-video-upload";
import { ThumbnailGenerator } from "../../../../../../thumbnail-generator";

function newBlockId() {
  return `blk_${Math.random().toString(36).slice(2, 10)}`;
}

function SortableBlock({
  block,
  onChange,
  onRemove,
}: {
  block: LessonBlock;
  onChange: (next: LessonBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  async function handleImageFile(file: File | undefined) {
    if (!file || block.type !== "image") return;
    setImageUploading(true);
    setImageError(null);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadLessonBlockImage(fd);
    setImageUploading(false);
    if ("error" in result) {
      setImageError(result.error);
      return;
    }
    onChange({ ...block, url: result.url });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex gap-2 rounded-xl border bg-card p-3"
    >
      <button
        type="button"
        aria-label="Verschieben"
        className="mt-1 flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        {block.type === "heading" && (
          <div className="flex items-center gap-2">
            <select
              value={block.level}
              onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}
              className="h-8 shrink-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
            >
              <option value={2}>Überschrift</option>
              <option value={3}>Unterüberschrift</option>
            </select>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              placeholder="Überschrift eingeben"
              className={block.level === 2 ? "text-lg font-semibold" : "font-medium"}
            />
          </div>
        )}

        {block.type === "paragraph" && (
          <Textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Text eingeben..."
            rows={4}
          />
        )}

        {block.type === "image" && (
          <div className="flex flex-col gap-2">
            {block.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.url} alt={block.caption} className="max-h-56 rounded-lg object-contain" />
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                {imageUploading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                {imageUploading ? "Wird hochgeladen..." : "Bild auswählen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
              </label>
            )}
            {block.url && (
              <label className="text-xs text-muted-foreground underline hover:text-foreground w-fit cursor-pointer">
                Bild ersetzen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
              </label>
            )}
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
            <Input
              value={block.caption}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder="Bildunterschrift (optional)"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Block löschen"
        onClick={onRemove}
        className="mt-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}

export function LessonEditor({
  courseId,
  courseTitle,
  moduleTitle,
  lessonId,
  title,
  description,
  thumbnailUrl,
  videoUrl,
  pdfUrl,
  notionUrl,
  initialBlocks,
}: {
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  pdfUrl: string | null;
  notionUrl: string | null;
  initialBlocks: LessonBlock[];
}) {
  const [error, formAction, isPending] = useActionState(updateLesson, undefined);
  useSaveToast(error, isPending, "Lektion gespeichert.");
  const [titleValue, setTitleValue] = useState(title);
  const [blocks, setBlocks] = useState<LessonBlock[]>(initialBlocks);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addBlock(type: LessonBlock["type"]) {
    const id = newBlockId();
    if (type === "heading") setBlocks((b) => [...b, { id, type: "heading", level: 2, text: "" }]);
    else if (type === "paragraph") setBlocks((b) => [...b, { id, type: "paragraph", text: "" }]);
    else setBlocks((b) => [...b, { id, type: "image", url: "", caption: "" }]);
  }

  function updateBlock(id: string, next: LessonBlock) {
    setBlocks((b) => b.map((blk) => (blk.id === id ? next : blk)));
  }

  function removeBlock(id: string) {
    setBlocks((b) => b.filter((blk) => blk.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((b) => {
      const oldIndex = b.findIndex((blk) => blk.id === active.id);
      const newIndex = b.findIndex((blk) => blk.id === over.id);
      return arrayMove(b, oldIndex, newIndex);
    });
  }

  return (
    <div className="p-4 sm:p-8">
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Zurück zur Kursverwaltung
      </Link>

      <p className="mt-4 text-sm text-muted-foreground">
        {courseTitle} &rsaquo; {moduleTitle}
      </p>
      <h1 className="mb-6 text-2xl font-semibold">Lektion bearbeiten</h1>

      <form action={formAction} className="flex max-w-2xl flex-col gap-6" encType="multipart/form-data">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="content" value={JSON.stringify(blocks)} />

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Input
            name="title"
            placeholder="Lektionstitel"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
          />
          <Textarea name="description" placeholder="Kurzbeschreibung (optional)" rows={2} defaultValue={description ?? ""} />
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <label className="text-sm font-medium">Video</label>
          <LessonVideoUpload existingVideoUrl={videoUrl} />
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <label className="text-sm font-medium">
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
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <label className="text-sm font-medium">Materialien</label>
          <Input name="pdfUrl" placeholder="PDF-Link (optional)" type="url" defaultValue={pdfUrl ?? ""} />
          <Input name="notionUrl" placeholder="Notion-Doc-Link (optional)" type="url" defaultValue={notionUrl ?? ""} />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Inhalt</label>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => addBlock("heading")}>
                <HeadingIcon className="size-4" />
                Überschrift
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addBlock("paragraph")}>
                <PilcrowIcon className="size-4" />
                Text
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addBlock("image")}>
                <ImageIcon className="size-4" />
                Bild
              </Button>
            </div>
          </div>

          {blocks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Noch keine Inhalte. Füge Überschriften, Text oder Bilder hinzu - per Drag-Handle frei sortierbar.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      onChange={(next) => updateBlock(block.id, next)}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}
