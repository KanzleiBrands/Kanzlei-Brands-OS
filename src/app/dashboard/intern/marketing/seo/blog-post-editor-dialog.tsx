"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  generateBlogPostDraft,
  updateBlogPost,
  moveBlogPostStatus,
  scheduleBlogPost,
  approveBlogPost,
  requestBlogPostChanges,
  deleteBlogPost,
} from "@/lib/actions/blog-posts";
import type { BlogPostItem } from "./blog-post-board";

const STATUS_LABELS: Record<BlogPostItem["status"], string> = {
  IDEA: "Idee",
  IN_PRODUCTION: "In Produktion",
  REVIEW: "Freigabe",
  CHANGES_REQUESTED: "Änderung gewünscht",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};
const MOVABLE_STATUSES: BlogPostItem["status"][] = ["IDEA", "IN_PRODUCTION", "REVIEW", "SCHEDULED"];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function BlogPostEditorDialog({
  post,
  canManage,
  open,
  onOpenChange,
}: {
  post: BlogPostItem;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(post.title ?? "");
  const [slug, setSlug] = useState(post.slug ?? "");
  const [metaTitle, setMetaTitle] = useState(post.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post.metaDescription ?? "");
  const [targetKeyword, setTargetKeyword] = useState(post.targetKeyword ?? "");
  const [content, setContent] = useState(post.content ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post.featuredImageUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(post.scheduledAt));
  const [feedback, setFeedback] = useState("");

  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isMoving, startMoving] = useTransition();
  const [isScheduling, startScheduling] = useTransition();
  const [isApproving, startApproving] = useTransition();
  const [, requestChangesAction, isRequestingChanges] = useActionState(requestBlogPostChanges, undefined);

  function handleGenerate() {
    startGenerating(async () => {
      const fd = new FormData();
      fd.set("postId", post.id);
      const result = await generateBlogPostDraft(fd);
      if ("error" in result) toast.error(result.error);
      else {
        setContent(result.content);
        toast.success("Artikel erstellt.");
      }
    });
  }

  function handleSave() {
    startSaving(async () => {
      const fd = new FormData();
      fd.set("postId", post.id);
      fd.set("title", title);
      fd.set("slug", slug);
      fd.set("metaTitle", metaTitle);
      fd.set("metaDescription", metaDescription);
      fd.set("targetKeyword", targetKeyword);
      fd.set("content", content);
      fd.set("featuredImageUrl", featuredImageUrl);
      const result = await updateBlogPost(fd);
      if (result?.error) toast.error(result.error);
      else toast.success("Gespeichert.");
    });
  }

  function handleMove(status: string) {
    startMoving(async () => {
      try {
        const fd = new FormData();
        fd.set("postId", post.id);
        fd.set("status", status);
        await moveBlogPostStatus(fd);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fehler beim Verschieben.");
      }
    });
  }

  function handleSaveSchedule() {
    startScheduling(async () => {
      const fd = new FormData();
      fd.set("postId", post.id);
      fd.set("scheduledAt", scheduledAt ? new Date(scheduledAt).toISOString() : "");
      await scheduleBlogPost(fd);
      toast.success("Termin gespeichert.");
    });
  }

  function handleApprove() {
    startApproving(async () => {
      const fd = new FormData();
      fd.set("postId", post.id);
      await approveBlogPost(fd);
      toast.success("Freigegeben.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post.title || "Blogartikel"}</DialogTitle>
          <DialogDescription>Status: {STATUS_LABELS[post.status]}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {post.ideaSourceLabel && (
            <p className="rounded-md border border-dashed bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              Quelle: {post.ideaSourceLabel}
            </p>
          )}
          {post.topic && <p className="text-sm text-muted-foreground">{post.topic}</p>}

          {post.status === "CHANGES_REQUESTED" && post.reviewFeedback && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
              <p className="font-medium text-destructive">Änderung gewünscht:</p>
              <p>{post.reviewFeedback}</p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label>Slug (URL)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="wird aus dem Titel generiert" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label>Ziel-Keyword</Label>
              <Input value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Meta-Titel (SEO, max. 60 Zeichen)</Label>
            <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={70} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Meta-Beschreibung (SEO, max. 155 Zeichen)</Label>
            <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} maxLength={200} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Bild-URL (Featured Image)</Label>
            <Input value={featuredImageUrl} onChange={(e) => setFeaturedImageUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>Artikeltext (Markdown)</Label>
              <Button type="button" size="sm" variant="outline" disabled={isGenerating} onClick={handleGenerate}>
                <SparklesIcon className="size-4" />
                {content ? "Neu erstellen" : "Text mit KI erstellen"}
              </Button>
            </div>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="font-mono text-xs" />
          </div>

          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Speichert..." : "Speichern"}
          </Button>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Status & Planung</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                defaultValue={post.status}
                disabled={isMoving || !canManage}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                onChange={(e) => handleMove(e.target.value)}
              >
                {MOVABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-56"
              />
              <Button type="button" size="sm" variant="outline" disabled={isScheduling} onClick={handleSaveSchedule}>
                Termin speichern
              </Button>
            </div>

            {post.status === "REVIEW" && canManage && (
              <div className="flex flex-col gap-1.5 border-t pt-2">
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" disabled={isApproving} onClick={handleApprove}>
                    Freigeben
                  </Button>
                </div>
                <form action={requestChangesAction} className="flex flex-col gap-1.5">
                  <input type="hidden" name="postId" value={post.id} />
                  <Textarea
                    name="feedback"
                    rows={2}
                    placeholder="Änderungswunsch beschreiben..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={isRequestingChanges}>
                    Änderung wünschen
                  </Button>
                </form>
              </div>
            )}

            {post.status === "PUBLISHED" && post.slug && (
              <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                Live ansehen: /blog/{post.slug}
              </a>
            )}
          </div>

          {canManage && (
            <Button
              type="button"
              variant="ghost"
              className="self-start text-destructive"
              onClick={() => {
                const fd = new FormData();
                fd.set("postId", post.id);
                deleteBlogPost(fd);
                onOpenChange(false);
              }}
            >
              Beitrag löschen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
