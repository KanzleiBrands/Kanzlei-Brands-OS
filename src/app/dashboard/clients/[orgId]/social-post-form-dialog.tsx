"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImageIcon, Loader2Icon, PencilIcon, PlusIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { createSocialPost, updateSocialPost, uploadSocialPostImage } from "@/lib/actions/social-posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { useSaveToast } from "@/hooks/use-save-toast";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };

export type SocialPostStatus =
  | "IDEA"
  | "IN_PRODUCTION"
  | "CLIENT_REVIEW"
  | "CHANGES_REQUESTED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type SocialPostData = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  status: SocialPostStatus;
  caption: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | null;
  channelId: string | null;
  pipelineId: string | null;
  responsibleUserId: string | null;
  scheduledAt: string | null; // ISO
  publishedAt: string | null; // ISO
  publishedUrl: string | null;
};

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

export function SocialPostFormDialog({
  organizationId,
  channels,
  pipelines,
  agencyUsers,
  post,
  variant = "default",
}: {
  organizationId: string;
  channels: Channel[];
  pipelines: Pipeline[];
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

  const [platform, setPlatform] = useState<Channel["platform"]>(post?.platform ?? "FACEBOOK");
  const [channelId, setChannelId] = useState(post?.channelId ?? "");
  const [mediaUrl, setMediaUrl] = useState(post?.mediaUrl ?? "");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO" | "">(post?.mediaType ?? "");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const channelsForPlatform = channels.filter((c) => c.platform === platform);

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
      setMediaUrl("");
      setMediaType("");
      setMediaError(null);
      setChannelId("");
      setPlatform("FACEBOOK");
    }
    setOpen(next);
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setMediaUploading(true);
    setMediaError(null);
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
    setMediaUploading(true);
    setMediaProgress(0);
    setMediaError(null);
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
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="mediaUrl" value={mediaUrl} />
          <input type="hidden" name="mediaType" value={mediaType} />

          <div className="flex flex-col gap-1">
            <Label>Plattform</Label>
            <div className="flex gap-1.5">
              {(["FACEBOOK", "INSTAGRAM", "LINKEDIN"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={platform === p ? "default" : "outline"}
                  onClick={() => {
                    setPlatform(p);
                    setChannelId("");
                  }}
                >
                  {PLATFORM_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="social-post-channel">Kanal</Label>
            <Select name="channelId" value={channelId} onValueChange={(value) => setChannelId(value ?? "")}>
              <SelectTrigger id="social-post-channel">
                <SelectValue>{() => channelsForPlatform.find((c) => c.id === channelId)?.displayName ?? "Kanal wählen"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {channelsForPlatform.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                    {!c.active ? " (Verbindung abgelaufen)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channelsForPlatform.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Noch kein {PLATFORM_LABELS[platform]}-Kanal verbunden - unten unter &bdquo;Kanäle&ldquo; verbinden.
              </p>
            )}
          </div>

          <Textarea name="caption" placeholder="Text / Caption" rows={4} defaultValue={post?.caption} required />

          <div className="flex flex-col gap-1.5">
            <Label>Bild oder Video</Label>
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
                    setMediaType("");
                  }}
                  className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-3.5" />
                  Entfernen
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <ImageIcon className="size-4" />
                  Bild auswählen
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(e.target.files?.[0])} />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <UploadCloudIcon className="size-4" />
                  Video auswählen
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFile(e.target.files?.[0])} />
                </label>
              </div>
            )}
            {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="social-post-scheduled">Geplantes Veröffentlichungsdatum</Label>
            <Input
              id="social-post-scheduled"
              type="datetime-local"
              name="scheduledAt"
              defaultValue={toDatetimeLocalValue(post?.scheduledAt ?? null)}
            />
          </div>

          {pipelines.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="social-post-pipeline">Kampagne (optional)</Label>
              <Select name="pipelineId" defaultValue={post?.pipelineId ?? ""}>
                <SelectTrigger id="social-post-pipeline">
                  <SelectValue>{(value: string) => pipelines.find((p) => p.id === value)?.name ?? "Keine"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {isPending ? "Wird gespeichert..." : isEdit ? "Speichern" : "Beitrag anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
