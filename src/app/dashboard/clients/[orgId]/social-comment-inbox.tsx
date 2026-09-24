"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";
import {
  replySocialComment,
  hideSocialComment,
  unhideSocialComment,
  deleteSocialComment,
} from "@/lib/actions/social-comments";

type Platform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";

export type CommentInboxPost = {
  id: string;
  platform: Platform;
  caption: string;
  mediaUrl: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
};

export type CommentInboxComment = {
  id: string;
  postId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  message: string;
  isHidden: boolean;
  isOwnReply: boolean;
  parentCommentId: string | null;
  postedAt: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CommentReplyForm({ commentId, onDone }: { commentId: string; onDone: () => void }) {
  const [error, formAction, isPending] = useActionState(replySocialComment, undefined);
  useSaveToast(error, isPending, "Antwort gesendet.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      onDone();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="commentId" value={commentId} />
      <textarea
        name="message"
        placeholder="Antwort schreiben..."
        required
        rows={2}
        autoFocus
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-end">
        {isPending ? "Wird gesendet..." : "Antworten"}
      </Button>
    </form>
  );
}

function CommentRow({
  comment,
  platform,
  depth,
  replyOpenId,
  setReplyOpenId,
}: {
  comment: CommentInboxComment;
  platform: Platform;
  depth: number;
  replyOpenId: string | null;
  setReplyOpenId: (id: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const canModerate = platform !== "LINKEDIN";

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${comment.isOwnReply ? "ml-6 bg-primary/5" : "bg-muted/30"} ${
        comment.isHidden ? "opacity-50" : ""
      }`}
      style={depth > 0 && !comment.isOwnReply ? { marginLeft: `${depth * 1.5}rem` } : undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <div className="flex items-center gap-2">
          {comment.isHidden && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">Verborgen</span>}
          <span>{formatDateTime(comment.postedAt)}</span>
        </div>
      </div>
      <p className="whitespace-pre-wrap">{comment.message}</p>
      {!comment.isOwnReply && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setReplyOpenId(comment.id)}>
            Antworten
          </button>
          {canModerate && (
            <button
              type="button"
              disabled={isPending}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const fd = new FormData();
                fd.set("commentId", comment.id);
                startTransition(async () => {
                  try {
                    await (comment.isHidden ? unhideSocialComment(fd) : hideSocialComment(fd));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Konnte nicht gespeichert werden.");
                  }
                });
              }}
            >
              {comment.isHidden ? <EyeIcon className="size-3" /> : <EyeOffIcon className="size-3" />}
              {comment.isHidden ? "Einblenden" : "Verbergen"}
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!window.confirm("Kommentar wirklich löschen?")) return;
              const fd = new FormData();
              fd.set("commentId", comment.id);
              startTransition(async () => {
                try {
                  await deleteSocialComment(fd);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Konnte nicht gelöscht werden.");
                }
              });
            }}
          >
            <Trash2Icon className="size-3" />
            Löschen
          </button>
        </div>
      )}
      {replyOpenId === comment.id && <CommentReplyForm commentId={comment.id} onDone={() => setReplyOpenId(null)} />}
    </div>
  );
}

export function SocialCommentInbox({ posts, comments }: { organizationId: string; posts: CommentInboxPost[]; comments: CommentInboxComment[] }) {
  const commentsByPost = useMemo(() => {
    const map = new Map<string, CommentInboxComment[]>();
    for (const comment of comments) {
      const list = map.get(comment.postId);
      if (list) list.push(comment);
      else map.set(comment.postId, [comment]);
    }
    return map;
  }, [comments]);

  const postsWithComments = useMemo(
    () =>
      posts
        .filter((post) => (commentsByPost.get(post.id)?.length ?? 0) > 0)
        .map((post) => {
          const list = commentsByPost.get(post.id) ?? [];
          const topLevel = list.filter((c) => !c.parentCommentId);
          const unanswered = topLevel.filter(
            (c) => !c.isOwnReply && !list.some((r) => r.parentCommentId === c.id && r.isOwnReply),
          ).length;
          const latest = list.reduce((max, c) => (c.postedAt > max ? c.postedAt : max), list[0]?.postedAt ?? "");
          return { post, total: list.length, unanswered, latest };
        })
        .sort((a, b) => (a.latest < b.latest ? 1 : -1)),
    [posts, commentsByPost],
  );

  const [selectedPostId, setSelectedPostId] = useState<string | null>(postsWithComments[0]?.post.id ?? null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const activePost = postsWithComments.find((p) => p.post.id === selectedPostId)?.post ?? null;
  const activeComments = activePost ? (commentsByPost.get(activePost.id) ?? []) : [];
  const topLevelComments = [...activeComments.filter((c) => !c.parentCommentId)].sort((a, b) =>
    a.postedAt < b.postedAt ? -1 : 1,
  );

  if (postsWithComments.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Noch keine Kommentare. Sobald jemand einen veröffentlichten Beitrag kommentiert, erscheint er hier - in Echtzeit
        per Webhook, zusätzlich alle 10 Minuten synchronisiert.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[420px] overflow-hidden rounded-lg border">
      <div className="w-72 flex-shrink-0 overflow-y-auto border-r">
        {postsWithComments.map(({ post, total, unanswered }) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setSelectedPostId(post.id)}
            className={`block w-full border-b px-3 py-3 text-left hover:bg-muted ${
              post.id === selectedPostId ? "bg-muted" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <PlatformIcon platform={post.platform} />
              <p className="line-clamp-2 min-w-0 flex-1 text-xs text-muted-foreground">{post.caption}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{total} Kommentar{total === 1 ? "" : "e"}</span>
              {unanswered > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {unanswered} offen
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!activePost ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Wähle links einen Beitrag aus.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b p-4">
              <div className="flex min-w-0 items-center gap-2">
                <PlatformIcon platform={activePost.platform} />
                <p className="line-clamp-1 text-sm">{activePost.caption}</p>
              </div>
              {activePost.publishedUrl && (
                <a href={activePost.publishedUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 text-xs text-primary underline">
                  Beitrag ansehen
                </a>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-3">
                {topLevelComments.map((comment) => (
                  <div key={comment.id} className="flex flex-col gap-2">
                    <CommentRow comment={comment} platform={activePost.platform} depth={0} replyOpenId={replyOpenId} setReplyOpenId={setReplyOpenId} />
                    {activeComments
                      .filter((r) => r.parentCommentId === comment.id)
                      .sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))
                      .map((reply) => (
                        <CommentRow
                          key={reply.id}
                          comment={reply}
                          platform={activePost.platform}
                          depth={1}
                          replyOpenId={replyOpenId}
                          setReplyOpenId={setReplyOpenId}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
