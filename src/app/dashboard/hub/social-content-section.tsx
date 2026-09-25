"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckIcon, PencilLineIcon } from "lucide-react";
import { approveSocialPost, requestSocialPostChanges } from "@/lib/actions/social-posts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icon";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ClientSocialPost = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  caption: string;
  mediaUrl: string | null;
  mediaUrls: string[];
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL" | null;
  status: "CLIENT_REVIEW" | "SCHEDULED" | "PUBLISHED";
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MediaPreview({ post }: { post: ClientSocialPost }) {
  if (post.mediaType === "CAROUSEL" && post.mediaUrls.length > 0) {
    return (
      <div className="relative overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.mediaUrls[0]} alt="" className="size-full object-contain" />
        <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          Karussell · {post.mediaUrls.length}
        </span>
      </div>
    );
  }
  if (!post.mediaUrl) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16 / 9" }}>
      {post.mediaType === "VIDEO" ? (
        <video src={post.mediaUrl} controls className="size-full object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt="" className="size-full object-contain" />
      )}
    </div>
  );
}

function ApprovalCard({ post }: { post: ClientSocialPost }) {
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [isApproving, startApproving] = useTransition();
  const [changeError, changeAction, isRequestingChange] = useActionState(requestSocialPostChanges, undefined);
  useSaveToast(changeError, isRequestingChange, "Änderungswunsch gesendet.");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PlatformIcon platform={post.platform} />
          <CardTitle className="text-base">Beitrag wartet auf deine Freigabe</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MediaPreview post={post} />
        <p className="text-sm whitespace-pre-line">{post.caption}</p>

        {!showChangeForm ? (
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={isApproving}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => {
                const fd = new FormData();
                fd.set("postId", post.id);
                startApproving(() => approveSocialPost(fd));
              }}
            >
              <CheckIcon className="size-4" />
              {isApproving ? "Wird freigegeben..." : "Freigeben"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowChangeForm(true)}>
              <PencilLineIcon className="size-4" />
              Änderung wünschen
            </Button>
          </div>
        ) : (
          <form action={changeAction} className="flex flex-col gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <Textarea name="feedback" placeholder="Was soll geändert werden?" rows={3} required />
            {changeError && <p className="text-sm text-destructive">{changeError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isRequestingChange}>
                {isRequestingChange ? "Wird gesendet..." : "Änderungswunsch senden"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowChangeForm(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function SocialContentSection({
  pendingApproval,
  timeline,
}: {
  pendingApproval: ClientSocialPost[];
  timeline: ClientSocialPost[];
}) {
  if (pendingApproval.length === 0 && timeline.length === 0) return null;

  return (
    <>
      <h2 className="mb-3 text-lg font-semibold">Social Media Content</h2>
      {pendingApproval.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pendingApproval.map((post) => (
            <ApprovalCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {timeline.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Zuletzt gepostet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {timeline.map((post) => (
              <div key={post.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                {post.mediaType === "CAROUSEL" && post.mediaUrls[0] ? (
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black" style={{ aspectRatio: "16 / 9" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.mediaUrls[0]} alt="" className="size-full object-contain" />
                  </div>
                ) : (
                  post.mediaUrl && (
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black" style={{ aspectRatio: "16 / 9" }}>
                      {post.mediaType === "VIDEO" ? (
                        <video src={post.mediaUrl} className="size-full object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.mediaUrl} alt="" className="size-full object-contain" />
                      )}
                    </div>
                  )
                )}
                <PlatformIcon platform={post.platform} />
                <p className="min-w-0 flex-1 truncate">{post.caption}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {post.status === "PUBLISHED"
                    ? `Veröffentlicht am ${formatDate(post.publishedAt!)}`
                    : `Geplant für ${formatDate(post.scheduledAt!)}`}
                </span>
                {post.publishedUrl && (
                  <a href={post.publishedUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">
                    Ansehen
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
