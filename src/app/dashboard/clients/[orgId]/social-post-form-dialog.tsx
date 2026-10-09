"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  ImagesIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { createSocialPost, updateSocialPost, uploadSocialPostImage } from "@/lib/actions/social-posts";
import { generatePostTextFromIdea } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { useSaveToast } from "@/hooks/use-save-toast";
import { AiCaptionAssistant } from "./ai-caption-assistant";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type AgencyUser = { id: string; name: string };

export type SocialPostStatus =
  | "IDEA"
  | "IN_PRODUCTION"
  | "CLIENT_REVIEW"
  | "CHANGES_REQUESTED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type SocialMediaTypeValue = "IMAGE" | "VIDEO" | "CAROUSEL";

const FORMAT_OPTIONS = [
  { value: "REEL", label: "Reel" },
  { value: "IMAGE_POST", label: "Bild-Post" },
  { value: "CAROUSEL", label: "Karussell" },
  { value: "THOUGHT_LEADERSHIP", label: "Thought Leadership" },
] as const;
export type SocialPostFormatValue = (typeof FORMAT_OPTIONS)[number]["value"];

const PLATFORM_FORMAT_DEFAULT: Record<Channel["platform"], SocialPostFormatValue> = {
  INSTAGRAM: "REEL",
  FACEBOOK: "REEL",
  LINKEDIN: "THOUGHT_LEADERSHIP",
};

export type SocialPostData = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  status: SocialPostStatus;
  caption: string;
  title: string | null;
  topic: string | null;
  contentFormatName: string | null;
  format: SocialPostFormatValue | null;
  script: string | null;
  mediaUrl: string | null;
  mediaUrls: string[];
  mediaType: SocialMediaTypeValue | null;
  channelId: string | null;
  responsibleUserId: string | null;
  scheduledAt: string | null; // ISO
  publishedAt: string | null; // ISO
  publishedUrl: string | null;
};

/**
 * Leitet für einen bestehenden Beitrag ohne gespeichertes Format (ältere
 * Beiträge, oder von der KI-Ideen-Generierung angelegte Entwürfe) eine
 * plausible Vorbelegung aus dem bereits hochgeladenen Medientyp ab - ohne
 * Daten zu verändern. Ein Beitrag ganz ohne Medium bleibt bewusst ohne
 * Format-Vorschlag, statt zu raten.
 */
function inferFormat(post: SocialPostData | undefined): SocialPostFormatValue | "" {
  if (!post) return "";
  if (post.format) return post.format;
  if (post.mediaType === "IMAGE") return "IMAGE_POST";
  if (post.mediaType === "CAROUSEL") return "CAROUSEL";
  if (post.mediaType === "VIDEO") return "REEL";
  return "";
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

const IMAGE_ASPECTS = [
  { value: "1:1", label: "1:1 (quadratisch)", ratio: 1 },
  { value: "4:5", label: "4:5 (Hochformat)", ratio: 4 / 5 },
] as const;
type ImageAspect = (typeof IMAGE_ASPECTS)[number]["value"];

// Reels sind immer Hochformat - anders als beim alten generischen "Video"
// gibt es hier keine Auswahl mehr (siehe SocialPostFormatValue).
const REEL_ASPECT_RATIO = 9 / 16;

const ASPECT_TOLERANCE = 0.04;

function matchesAspect(width: number, height: number, target: number): boolean {
  const actual = width / height;
  return Math.abs(actual - target) / target <= ASPECT_TOLERANCE;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    img.src = url;
  });
}

function readVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video konnte nicht gelesen werden."));
    };
    video.src = url;
  });
}

function SortableCarouselImage({ url, onRemove }: { url: string; onRemove: () => void }) {
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
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
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

const PLATFORM_LABELS: Record<Channel["platform"], string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
};

const CALENDAR_CHIP_STATUS_CLASS: Partial<Record<SocialPostStatus, string>> = {
  PUBLISHED: "bg-emerald-500/15",
  FAILED: "bg-destructive/15",
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Wandelt den Wert eines datetime-local-Felds (z.B. "2026-10-08T17:40",
 * ohne Zeitzone) in einen echten UTC-ISO-String um. Die Umwandlung muss im
 * Browser passieren: der new Date(year, month, day, hour, minute)-
 * Konstruktor interpretiert die Zahlen als Zeit in der Zeitzone, in der der
 * Code gerade läuft - im Browser also korrekt die Zeitzone des Nutzers.
 * Würde man stattdessen den rohen "2026-10-08T17:40"-String erst beim
 * Server-Action-Aufruf mit new Date(string) parsen, interpretiert Node das
 * (mangels Zeitzone im String) als UTC, nicht als Browser-Ortszeit - auf
 * dem in UTC laufenden Vercel-Server verschiebt das jede geplante Zeit um
 * die Differenz zur Nutzer-Zeitzone (in Deutschland +1/+2h).
 */
function localDatetimeToIso(local: string): string {
  if (!local) return "";
  const [datePart, timePart] = local.split("T");
  if (!datePart || !timePart) return "";
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function SocialPostFormDialog({
  organizationId,
  channels,
  agencyUsers,
  post,
  variant = "default",
}: {
  organizationId: string;
  channels: Channel[];
  agencyUsers: AgencyUser[];
  post?: SocialPostData;
  /** "calendarChip" renders the trigger as a small platform-icon + caption chip for the calendar view, instead of the default edit-pencil/create-button. */
  variant?: "default" | "calendarChip";
}) {
  const isEdit = !!post;
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(isEdit ? updateSocialPost : createSocialPost, undefined);
  useSaveToast(error, isPending, isEdit ? "Beitrag gespeichert." : "Beitrag angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // Mehrere Plattformen gleichzeitig auswählbar - sowohl beim Anlegen als auch
  // beim Bearbeiten (ein bestehender Beitrag kann nachträglich auf weitere
  // Plattformen ausgeweitet werden). Die ursprüngliche Plattform eines
  // bearbeiteten Beitrags bleibt dabei fix (siehe togglePlatform) - für sie
  // wird der bestehende Beitrag aktualisiert, für jede zusätzlich gewählte
  // Plattform legt die Server Action einen neuen Beitrag an.
  const [selectedPlatforms, setSelectedPlatforms] = useState<Channel["platform"][]>(post ? [post.platform] : ["FACEBOOK"]);
  const [channelByPlatform, setChannelByPlatform] = useState<Record<string, string>>(
    post ? { [post.platform]: post.channelId ?? "" } : {},
  );
  const [format, setFormat] = useState<SocialPostFormatValue | "">(
    isEdit ? inferFormat(post) : PLATFORM_FORMAT_DEFAULT[selectedPlatforms[0]],
  );
  const [script, setScript] = useState(post?.script ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [mediaUrl, setMediaUrl] = useState(post?.mediaUrl ?? "");
  const [mediaType, setMediaType] = useState<SocialMediaTypeValue | "">(post?.mediaType ?? "");
  const [imageAspect, setImageAspect] = useState<ImageAspect>("1:1");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<{ id: string; url: string }[]>(
    (post?.mediaUrls ?? []).map((url) => ({ id: newId(), url })),
  );
  const [carouselUploading, setCarouselUploading] = useState(false);
  const [publishNow, setPublishNow] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState(toDatetimeLocalValue(post?.scheduledAt ?? null));
  const carouselSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [isGeneratingText, startGenerateTextTransition] = useTransition();
  const [generateTextError, setGenerateTextError] = useState<string | null>(null);

  function handleGenerateText() {
    if (!post) return;
    setGenerateTextError(null);
    startGenerateTextTransition(async () => {
      const fd = new FormData();
      fd.set("postId", post.id);
      const result = await generatePostTextFromIdea(fd);
      if ("error" in result) {
        setGenerateTextError(result.error);
      } else {
        setCaption(result.caption);
      }
    });
  }

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  // Das Format bestimmt den Medientyp - beim Wechseln also konsistent nach-
  // ziehen. Löst für bereits geladene Daten eines bestehenden Beitrags nichts
  // aus, weil der Medientyp dann schon zum (ggf. hergeleiteten) Format passt.
  function selectFormat(next: SocialPostFormatValue) {
    setFormat(next);
    if (next === "REEL") {
      setMediaType("VIDEO");
      setCarousel([]);
    } else if (next === "IMAGE_POST") {
      setMediaType("IMAGE");
      setCarousel([]);
    } else if (next === "CAROUSEL") {
      setMediaType("CAROUSEL");
      setMediaUrl("");
    } else if (next === "THOUGHT_LEADERSHIP") {
      // Bild bleibt optional - anders als bei REEL/CAROUSEL kein fester
      // Medientyp, also nichts zurücksetzen außer dem (hier nicht nutzbaren)
      // Karussell; ein zuvor hochgeladenes Bild bleibt erhalten, ein Video
      // (von einem vorherigen Reel) ergibt hier keinen Sinn und wird entfernt.
      setCarousel([]);
      if (mediaType === "VIDEO") {
        setMediaUrl("");
        setMediaType("");
      }
    }
  }

  function togglePlatform(p: Channel["platform"]) {
    setSelectedPlatforms((prev) => {
      if (prev.includes(p)) {
        // Mindestens eine Plattform muss ausgewählt bleiben.
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  }

  function handleOpenChange(next: boolean) {
    if (next && !isEdit) {
      // Reset a create dialog's fields each time it's reopened, so a
      // previous submission's state doesn't linger into the next one.
      formRef.current?.reset();
      setCaption("");
      setMediaUrl("");
      setMediaType("");
      setImageAspect("1:1");
      setMediaError(null);
      setCarousel([]);
      setSelectedPlatforms(["FACEBOOK"]);
      setChannelByPlatform({});
      setFormat(PLATFORM_FORMAT_DEFAULT.FACEBOOK);
      setScript("");
      setPublishNow(false);
      setScheduledAtLocal("");
    }
    setOpen(next);
  }

  async function handleCarouselFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMediaError(null);
    const target = IMAGE_ASPECTS.find((a) => a.value === imageAspect)!;
    setCarouselUploading(true);
    for (const file of Array.from(files)) {
      try {
        const { width, height } = await readImageDimensions(file);
        if (!matchesAspect(width, height, target.ratio)) {
          setMediaError(
            `"${file.name}" hat ${width}×${height}px - erwartet wird ${target.label}. Bitte im gewählten Format zuschneiden und erneut hochladen.`,
          );
          continue;
        }
      } catch {
        setMediaError(`"${file.name}" konnte nicht gelesen werden.`);
        continue;
      }
      const fd = new FormData();
      fd.set("image", file);
      const result = await uploadSocialPostImage(fd);
      if (!("error" in result)) {
        setCarousel((c) => [...c, { id: newId(), url: result.url }]);
      } else {
        setMediaError(result.error);
      }
    }
    setCarouselUploading(false);
  }

  function handleCarouselDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCarousel((c) => {
      const oldIndex = c.findIndex((item) => item.id === active.id);
      const newIndex = c.findIndex((item) => item.id === over.id);
      return arrayMove(c, oldIndex, newIndex);
    });
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setMediaError(null);
    const target = IMAGE_ASPECTS.find((a) => a.value === imageAspect)!;
    try {
      const { width, height } = await readImageDimensions(file);
      if (!matchesAspect(width, height, target.ratio)) {
        setMediaError(
          `Bild hat ${width}×${height}px - erwartet wird ${target.label}. Bitte im gewählten Format zuschneiden und erneut hochladen.`,
        );
        return;
      }
    } catch {
      setMediaError("Bild konnte nicht gelesen werden.");
      return;
    }
    setMediaUploading(true);
    const fd = new FormData();
    fd.set("image", file);
    const result = await uploadSocialPostImage(fd);
    setMediaUploading(false);
    if ("error" in result) {
      setMediaError(result.error);
      return;
    }
    setMediaUrl(result.url);
    setMediaType("IMAGE");
  }

  async function handleVideoFile(file: File | undefined) {
    if (!file) return;
    setMediaError(null);
    try {
      const { width, height } = await readVideoDimensions(file);
      if (!matchesAspect(width, height, REEL_ASPECT_RATIO)) {
        setMediaError(`Video hat ${width}×${height}px - Reels brauchen ein Hochformat-Video (9:16). Bitte zuschneiden und erneut hochladen.`);
        return;
      }
    } catch {
      setMediaError("Video konnte nicht gelesen werden.");
      return;
    }
    setMediaUploading(true);
    setMediaProgress(0);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/video",
        onUploadProgress: (event) => setMediaProgress(Math.round(event.percentage)),
      });
      setMediaUrl(blob.url);
      setMediaType("VIDEO");
    } catch {
      setMediaError("Video-Upload fehlgeschlagen.");
    } finally {
      setMediaUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {variant === "calendarChip" && post ? (
        <DialogTrigger
          render={
            <button
              type="button"
              className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[0.7rem] ${
                CALENDAR_CHIP_STATUS_CLASS[post.status] ?? "bg-primary/10"
              }`}
            />
          }
        >
          <PlatformIcon platform={post.platform} className="size-3.5" />
          <span className="truncate">{post.caption}</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            isEdit ? (
              <button type="button" aria-label="Beitrag bearbeiten" className="text-muted-foreground hover:text-foreground" />
            ) : (
              <Button type="button" size="sm" />
            )
          }
        >
          {isEdit ? (
            <PencilIcon className="size-4" />
          ) : (
            <>
              <PlusIcon className="size-4" />
              Beitrag anlegen
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Beitrag bearbeiten" : "Beitrag anlegen"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          {isEdit && <input type="hidden" name="postId" value={post.id} />}
          {isEdit && <input type="hidden" name="platform" value={post.platform} />}
          {isEdit && <input type="hidden" name="channelId" value={channelByPlatform[post.platform] ?? ""} />}
          {isEdit && (
            <input
              type="hidden"
              name="extraSelections"
              value={JSON.stringify(
                selectedPlatforms
                  .filter((p) => p !== post.platform)
                  .map((p) => ({ platform: p, channelId: channelByPlatform[p] ?? "" })),
              )}
            />
          )}
          {!isEdit && (
            <input
              type="hidden"
              name="selections"
              value={JSON.stringify(selectedPlatforms.map((p) => ({ platform: p, channelId: channelByPlatform[p] ?? "" })))}
            />
          )}
          <input type="hidden" name="mediaUrl" value={mediaUrl} />
          <input type="hidden" name="mediaType" value={mediaType} />
          <input type="hidden" name="mediaUrls" value={JSON.stringify(carousel.map((c) => c.url))} />
          <input type="hidden" name="format" value={format} />
          <input type="hidden" name="script" value={format === "REEL" ? script : ""} />

          <div className="flex flex-col gap-1">
            <Label>Plattform{selectedPlatforms.length > 1 || !isEdit ? " (mehrere gleichzeitig möglich)" : ""}</Label>
            <div className="flex gap-1.5">
              {(["FACEBOOK", "INSTAGRAM", "LINKEDIN"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={selectedPlatforms.includes(p) ? "default" : "outline"}
                  disabled={isEdit && p === post.platform}
                  onClick={() => togglePlatform(p)}
                >
                  {PLATFORM_LABELS[p]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? `${PLATFORM_LABELS[post.platform]} ist die Plattform dieses Beitrags - zusätzliche Plattformen auswählen, um denselben Beitrag auch dort anzulegen.`
                : "Legt beim Speichern einen Beitrag pro ausgewählter Plattform an (gleicher Text/Medien/Termin)."}
            </p>
          </div>

          {selectedPlatforms.map((p) => {
            const channelsForP = channels.filter((c) => c.platform === p);
            return (
              <div key={p} className="flex flex-col gap-1">
                <Label>Kanal ({PLATFORM_LABELS[p]})</Label>
                <Select
                  value={channelByPlatform[p] ?? ""}
                  onValueChange={(value) => setChannelByPlatform((prev) => ({ ...prev, [p]: value ?? "" }))}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {() => channelsForP.find((c) => c.id === channelByPlatform[p])?.displayName ?? "Kanal wählen"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {channelsForP.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                        {!c.active ? " (Verbindung abgelaufen)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {channelsForP.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Noch kein {PLATFORM_LABELS[p]}-Kanal verbunden - unten unter &bdquo;Kanäle&ldquo; verbinden.
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex flex-col gap-1">
            <Label>Format</Label>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={format === option.value ? "default" : "outline"}
                  onClick={() => selectFormat(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isEdit && post.title && (
            <div className="flex flex-col gap-0.5 rounded-md border bg-muted/40 p-2 text-sm">
              <p className="font-medium">{post.title}</p>
              {post.contentFormatName && (
                <p className="text-xs text-muted-foreground">Copywriting-Framework: {post.contentFormatName}</p>
              )}
              {post.topic && <p className="mt-1 text-xs text-muted-foreground">{post.topic}</p>}
            </div>
          )}

          {isEdit && !caption && post.topic && post.contentFormatName && (
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" disabled={isGeneratingText} onClick={handleGenerateText}>
                {isGeneratingText ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                Text mit KI erstellen
              </Button>
              {generateTextError && <p className="text-xs text-destructive">{generateTextError}</p>}
            </div>
          )}

          {format === "REEL" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="social-post-script">Skript (Reel)</Label>
              <Textarea
                id="social-post-script"
                rows={5}
                placeholder="Szene für Szene: was ist zu sehen, was wird gesagt/eingeblendet..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="social-post-caption">{format === "REEL" ? "Hook / Kurz-Caption" : "Beitragstext"}</Label>
            <Textarea
              id="social-post-caption"
              name="caption"
              placeholder={format === "REEL" ? "Kurze, starke Hook zum Reel-Inhalt - kein langer Text" : "Text / Caption"}
              rows={format === "REEL" ? 2 : format === "THOUGHT_LEADERSHIP" ? 8 : 4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              required
            />
          </div>
          <AiCaptionAssistant caption={caption} platform={selectedPlatforms[0]} onInsert={(text) => setCaption(text)} />

          {(format === "IMAGE_POST" || format === "CAROUSEL" || format === "THOUGHT_LEADERSHIP") && (
            <div className="flex flex-col gap-1">
              <Label>Seitenverhältnis</Label>
              <div className="flex gap-1.5">
                {IMAGE_ASPECTS.map((a) => (
                  <Button
                    key={a.value}
                    type="button"
                    size="sm"
                    variant={imageAspect === a.value ? "default" : "outline"}
                    onClick={() => setImageAspect(a.value)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {format === "CAROUSEL" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Karussell-Bilder (2-10)</Label>
                <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
                  {carouselUploading ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImagesIcon className="size-3.5" />}
                  Bilder hinzufügen
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={carouselUploading}
                    onChange={(e) => handleCarouselFiles(e.target.files)}
                  />
                </label>
              </div>
              {carousel.length > 0 && (
                <DndContext sensors={carouselSensors} collisionDetection={closestCenter} onDragEnd={handleCarouselDragEnd}>
                  <SortableContext items={carousel.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1.5">
                      {carousel.map((item) => (
                        <SortableCarouselImage
                          key={item.id}
                          url={item.url}
                          onRemove={() => setCarousel((c) => c.filter((x) => x.id !== item.id))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
            </div>
          )}

          {(format === "IMAGE_POST" || format === "REEL" || format === "THOUGHT_LEADERSHIP") && (
            <div className="flex flex-col gap-1.5">
              {mediaUploading ? (
                <div className="rounded-md border p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-sm">
                    <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                    <span>Wird hochgeladen...</span>
                    {mediaProgress > 0 && <span className="ml-auto font-medium">{mediaProgress}%</span>}
                  </div>
                </div>
              ) : mediaUrl ? (
                <div className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
                    {mediaType === "VIDEO" ? (
                      <video src={mediaUrl} controls className="size-full object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt="" className="size-full object-contain" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl("");
                    }}
                    className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-3.5" />
                    Entfernen
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(format === "IMAGE_POST" || format === "THOUGHT_LEADERSHIP") && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                      <ImageIcon className="size-4" />
                      Bild {format === "THOUGHT_LEADERSHIP" ? "hinzufügen (optional)" : "auswählen"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(e.target.files?.[0])} />
                    </label>
                  )}
                  {format === "REEL" && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                      <UploadCloudIcon className="size-4" />
                      Video auswählen (Hochformat 9:16)
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFile(e.target.files?.[0])} />
                    </label>
                  )}
                </div>
              )}
              {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
            </div>
          )}

          <input type="hidden" name="scheduledAt" value={publishNow ? "" : localDatetimeToIso(scheduledAtLocal)} />
          <input type="hidden" name="publishNow" value={publishNow ? "1" : "0"} />

          <div className="flex flex-col gap-1.5">
            <Label>Zeitpunkt</Label>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant={!publishNow ? "default" : "outline"} onClick={() => setPublishNow(false)}>
                Für später planen
              </Button>
              <Button type="button" size="sm" variant={publishNow ? "default" : "outline"} onClick={() => setPublishNow(true)}>
                Sofort veröffentlichen
              </Button>
            </div>
            {!publishNow && (
              <Input
                id="social-post-scheduled"
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
              />
            )}
            {publishNow && (
              <p className="text-xs text-muted-foreground">
                Wird beim Speichern sofort veröffentlicht, ohne auf den nächsten geplanten Termin zu warten.
              </p>
            )}
          </div>

          {agencyUsers.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="social-post-responsible">Zuständig (optional)</Label>
              <Select name="responsibleUserId" defaultValue={post?.responsibleUserId ?? ""}>
                <SelectTrigger id="social-post-responsible">
                  <SelectValue>{(value: string) => agencyUsers.find((u) => u.id === value)?.name ?? "Niemand"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Niemand</SelectItem>
                  {agencyUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending
              ? publishNow
                ? "Wird veröffentlicht..."
                : "Wird gespeichert..."
              : publishNow
                ? "Jetzt veröffentlichen"
                : isEdit
                  ? "Speichern"
                  : "Beitrag anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
