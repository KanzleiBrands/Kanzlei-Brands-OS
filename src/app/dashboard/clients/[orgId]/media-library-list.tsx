"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { uploadMediaLibraryItems, deleteMediaLibraryItem } from "@/lib/actions/media-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MediaLibraryItemData = { id: string; url: string; tags: string[] };

/**
 * Bilder-Bibliothek pro Kunde (Konfiguration-Reiter) - mehrere bereits
 * passend zugeschnittene Bilder (z.B. aus Canva) auf einen Schlag
 * hochladen, statt sie im Post-Editor jedes Mal einzeln neu hochzuladen.
 * Die Auswahl im Editor passiert über MediaLibraryPicker in derselben Datei.
 */
export function MediaLibraryList({ organizationId, items }: { organizationId: string; items: MediaLibraryItemData[] }) {
  const [isUploading, startUpload] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("tags", tagsInput);
    for (const file of Array.from(files)) fd.append("images", file);
    startUpload(async () => {
      const result = await uploadMediaLibraryItems(fd);
      if ("error" in result) setError(result.error);
      else formRef.current?.reset();
    });
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startDelete(() => deleteMediaLibraryItem(fd));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Mehrere bereits passend zugeschnittene Bilder (z.B. 1:1/4:5/9:16-Exporte aus Canva) auf einen Schlag hochladen -
        im Post-Editor dann per Klick statt Einzel-Upload auswählbar. Optional mit Tags (z.B. &bdquo;Teamfoto,
        Büro&ldquo;) zum schnelleren Filtern.
      </p>

      <form ref={formRef} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="media-library-tags">Tags (optional, kommagetrennt)</Label>
          <Input
            id="media-library-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="z.B. Teamfoto, Zitat-Template"
          />
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
          {isUploading ? <Loader2Icon className="size-4 animate-spin" /> : <UploadCloudIcon className="size-4" />}
          {isUploading ? "Wird hochgeladen..." : "Bilder hochladen"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUploading}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-md border bg-black" style={{ aspectRatio: "1 / 1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label="Entfernen"
                disabled={isDeleting}
                onClick={() => handleDelete(item.id)}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2Icon className="size-3.5" />
              </button>
              {item.tags.length > 0 && (
                <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/70 px-1 py-0.5 text-[0.6rem] text-white">
                  {item.tags.join(", ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Auswahl-Grid im Post-Editor (social-post-form-dialog.tsx) - reine Darstellung, keine eigene Dialog-Hülle. */
export function MediaLibraryPicker({ items, onSelect }: { items: MediaLibraryItemData[]; onSelect: (url: string) => void }) {
  const allTags = Array.from(new Set(items.flatMap((i) => i.tags))).sort();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const filtered = activeTag ? items.filter((i) => i.tags.includes(activeTag)) : items;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Bilder in der Bibliothek dieses Kunden.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant={activeTag === null ? "default" : "outline"} onClick={() => setActiveTag(null)}>
            Alle
          </Button>
          {allTags.map((tag) => (
            <Button key={tag} type="button" size="sm" variant={activeTag === tag ? "default" : "outline"} onClick={() => setActiveTag(tag)}>
              {tag}
            </Button>
          ))}
        </div>
      )}
      <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.url)}
            className="overflow-hidden rounded-md border bg-black transition-opacity hover:opacity-80"
            style={{ aspectRatio: "1 / 1" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
