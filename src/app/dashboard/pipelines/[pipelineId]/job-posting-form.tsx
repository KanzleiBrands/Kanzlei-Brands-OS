"use client";

import { useActionState, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  ImageIcon,
  Loader2Icon,
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
import { updateJobPosting, uploadJobPostingImage } from "@/lib/actions/job-postings";
import { JOB_PORTALS } from "@/lib/job-portals";
import { EMPLOYMENT_TYPES } from "@/lib/job-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSaveToast } from "@/hooks/use-save-toast";

export type JobPostingData = {
  heroImageUrl: string | null;
  galleryUrls: string[];
  aboutUs: string | null;
  tasks: string | null;
  profile: string | null;
  benefitsList: string[];
  contactName: string | null;
  contactEmail: string | null;
  applicationUrl: string | null;
  targetPortals: string[];
  employerName: string | null;
  employerLogoUrl: string | null;
  employerWebsite: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  employmentType: string | null;
  validThrough: string | null;
  isPublished: boolean;
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

export function JobPostingForm({
  pipelineId,
  pipelineName,
  organizationName,
  publicUrl,
  jobPosting,
}: {
  pipelineId: string;
  pipelineName: string;
  organizationName: string;
  publicUrl: string;
  jobPosting: JobPostingData | null;
}) {
  const [error, formAction, isPending] = useActionState(updateJobPosting, undefined);
  useSaveToast(error, isPending, "Stellenportal-Inhalte gespeichert.");

  const [heroUrl, setHeroUrl] = useState(jobPosting?.heroImageUrl ?? "");
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);

  const [gallery, setGallery] = useState<{ id: string; url: string }[]>(
    (jobPosting?.galleryUrls ?? []).map((url) => ({ id: newId(), url })),
  );
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [benefits, setBenefits] = useState<string[]>(jobPosting?.benefitsList ?? []);
  const [benefitDraft, setBenefitDraft] = useState("");

  const [selectedPortals, setSelectedPortals] = useState<Set<string>>(new Set(jobPosting?.targetPortals ?? []));

  const [employerLogoUrl, setEmployerLogoUrl] = useState(jobPosting?.employerLogoUrl ?? "");
  const [employerLogoUploading, setEmployerLogoUploading] = useState(false);
  const [isPublished, setIsPublished] = useState(jobPosting?.isPublished ?? false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleHeroFile(file: File | undefined) {
    if (!file) return;
    setHeroUploading(true);
    setHeroError(null);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadJobPostingImage(fd);
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
      const result = await uploadJobPostingImage(fd);
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

  function addBenefit() {
    const text = benefitDraft.trim();
    if (!text) return;
    setBenefits((b) => [...b, text]);
    setBenefitDraft("");
  }

  function moveBenefit(index: number, dir: -1 | 1) {
    setBenefits((b) => {
      const target = index + dir;
      if (target < 0 || target >= b.length) return b;
      const next = [...b];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleEmployerLogoFile(file: File | undefined) {
    if (!file) return;
    setEmployerLogoUploading(true);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadJobPostingImage(fd);
    setEmployerLogoUploading(false);
    if (!("error" in result)) setEmployerLogoUrl(result.url);
  }

  function togglePortal(key: string) {
    setSelectedPortals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <input type="hidden" name="heroImageUrl" value={heroUrl} />
      <input type="hidden" name="galleryUrls" value={JSON.stringify(gallery.map((g) => g.url))} />
      <input type="hidden" name="benefitsList" value={JSON.stringify(benefits)} />
      <input type="hidden" name="targetPortals" value={JSON.stringify([...selectedPortals])} />
      <input type="hidden" name="employerLogoUrl" value={employerLogoUrl} />
      <input type="hidden" name="isPublished" value={isPublished ? "true" : "false"} />

      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Stellentitel: <span className="font-medium text-foreground">{pipelineName}</span> - der Titel entspricht immer
        dem Kampagnennamen und wird hier nicht separat gepflegt.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arbeitgeber & Arbeitsort</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Diese Angaben erscheinen als Herausgeber der Stelle - bei Google for Jobs und (perspektivisch) weiteren
            Portalen also der Kunde, nie Kanzlei Brands als Agentur.
          </p>
          <div className="flex items-center gap-3">
            {employerLogoUrl ? (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={employerLogoUrl} alt="" className="size-full object-contain" />
                <button
                  type="button"
                  aria-label="Logo entfernen"
                  onClick={() => setEmployerLogoUrl("")}
                  className="absolute top-0 right-0 flex size-4 items-center justify-center bg-background/80 text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ) : (
              <label className="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-foreground">
                {employerLogoUploading ? <Loader2Icon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={employerLogoUploading}
                  onChange={(e) => handleEmployerLogoFile(e.target.files?.[0])}
                />
              </label>
            )}
            <div className="flex flex-1 flex-col gap-1.5">
              <Input name="employerName" placeholder={organizationName || "Firmenname des Kunden"} defaultValue={jobPosting?.employerName ?? ""} />
              <Input
                name="employerWebsite"
                type="url"
                placeholder="Webseite des Kunden (optional)"
                defaultValue={jobPosting?.employerWebsite ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input name="street" placeholder="Straße & Nr." className="col-span-2 sm:col-span-2" defaultValue={jobPosting?.street ?? ""} />
            <Input name="postalCode" placeholder="PLZ" defaultValue={jobPosting?.postalCode ?? ""} />
            <Input name="city" placeholder="Stadt" defaultValue={jobPosting?.city ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              name="employmentType"
              defaultValue={jobPosting?.employmentType ?? "FULL_TIME"}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <Input
              name="validThrough"
              type="date"
              defaultValue={jobPosting?.validThrough ?? ""}
              title="Ausschreibung gültig bis (optional)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stellenanzeigenbilder</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Titelbild</label>
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
                <button type="button" className="text-xs text-muted-foreground underline hover:text-destructive" onClick={() => setHeroUrl("")}>
                  Entfernen
                </button>
              </div>
            )}
            {heroError && <p className="text-xs text-destructive">{heroError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Weitere Bilder / Galerie</label>
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
                      <SortableGalleryImage key={item.id} url={item.url} onRemove={() => setGallery((g) => g.filter((x) => x.id !== item.id))} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stellenbeschreibung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Über uns</label>
            <Textarea name="aboutUs" placeholder="Kurzvorstellung der Kanzlei / des Mandanten" rows={3} defaultValue={jobPosting?.aboutUs ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Aufgaben</label>
            <Textarea name="tasks" placeholder="Was macht die Person in dieser Rolle?" rows={4} defaultValue={jobPosting?.tasks ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Profil / Anforderungen</label>
            <Textarea name="profile" placeholder="Was sollte die Person mitbringen?" rows={4} defaultValue={jobPosting?.profile ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benefits</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {benefits.length > 0 && (
            <div className="flex flex-col gap-1">
              {benefits.map((text, index) => (
                <div key={index} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-sm">
                  <span className="flex-1">{text}</span>
                  <button
                    type="button"
                    aria-label="Nach oben"
                    disabled={index === 0}
                    onClick={() => moveBenefit(index, -1)}
                    className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Nach unten"
                    disabled={index === benefits.length - 1}
                    onClick={() => moveBenefit(index, 1)}
                    className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Entfernen"
                    onClick={() => setBenefits((b) => b.filter((_, i) => i !== index))}
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
              value={benefitDraft}
              onChange={(e) => setBenefitDraft(e.target.value)}
              placeholder="z.B. 30 Tage Urlaub"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBenefit();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addBenefit}>
              Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bewerbung & Kontakt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input name="contactName" placeholder="Ansprechpartner (optional)" defaultValue={jobPosting?.contactName ?? ""} />
          <Input name="contactEmail" type="email" placeholder="Kontakt-E-Mail (optional)" defaultValue={jobPosting?.contactEmail ?? ""} />
          <Input name="applicationUrl" type="url" placeholder="Bewerbungslink (optional)" defaultValue={jobPosting?.applicationUrl ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Veröffentlichung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            <span>
              <span className="font-medium">Öffentlich sichtbar</span>
              <span className="block text-xs text-muted-foreground">
                Schaltet die eigene Stellenanzeige-Seite live - inkl. JobPosting-Strukturdaten für Google for Jobs.
                Indeed crawlt dieselbe Seite ebenfalls, sobald der klassische XML-Feed 2026 wegfällt. Benötigt
                mindestens die Stadt unter &bdquo;Arbeitgeber & Arbeitsort&ldquo;.
              </span>
            </span>
          </label>
          {isPublished && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              <Input readOnly value={publicUrl} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(publicUrl)}>
                Kopieren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zielportale</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Checkliste, wo diese Stelle zusätzlich veröffentlicht werden soll. Google for Jobs läuft automatisch über
            die eigene Stellenanzeige-Seite oben; für die übrigen Portale braucht es weitere Schritte deinerseits
            (Account, Vertrag oder Multiposting-Dienstleister) - siehe Hinweise je Portal.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {JOB_PORTALS.map((portal) => (
              <label key={portal.key} className="flex items-start gap-2 rounded-md border bg-card p-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedPortals.has(portal.key)}
                  onChange={() => togglePortal(portal.key)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{portal.label}</span>
                  {portal.note && <span className="block text-xs text-muted-foreground">{portal.note}</span>}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
