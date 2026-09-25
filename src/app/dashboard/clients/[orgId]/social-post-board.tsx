"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarIcon, Trash2Icon, UserIcon } from "lucide-react";
import { moveSocialPostStatus, deleteSocialPost } from "@/lib/actions/social-posts";
import { PlatformIcon } from "@/components/platform-icon";
import { SocialPostFormDialog, type SocialPostData, type SocialPostStatus } from "./social-post-form-dialog";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };

export type BoardPost = SocialPostData & {
  status: SocialPostStatus;
  clientFeedback: string | null;
  publishError: string | null;
  responsibleName: string | null;
};

const COLUMNS: { status: BoardPost["status"]; label: string; droppable: boolean }[] = [
  { status: "IDEA", label: "Idee", droppable: true },
  { status: "IN_PRODUCTION", label: "In Produktion", droppable: true },
  { status: "CLIENT_REVIEW", label: "Kundenfreigabe", droppable: true },
  { status: "CHANGES_REQUESTED", label: "Änderung gewünscht", droppable: false },
  { status: "SCHEDULED", label: "Geplant", droppable: true },
  { status: "PUBLISHED", label: "Veröffentlicht", droppable: false },
  { status: "FAILED", label: "Fehlgeschlagen", droppable: false },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function PostCard({ post, organizationId, channels, pipelines, agencyUsers }: {
  post: BoardPost;
  organizationId: string;
  channels: Channel[];
  pipelines: Pipeline[];
  agencyUsers: AgencyUser[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id });
  const [isPending, startTransition] = useTransition();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="flex flex-col gap-2 rounded-lg border bg-card p-2.5 text-sm"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Verschieben"
          className="mt-0.5 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <PlatformIcon platform={post.platform} />
        </button>
        <p className="min-w-0 flex-1 line-clamp-3 whitespace-pre-line">{post.caption}</p>
      </div>
      {post.mediaType === "CAROUSEL" && post.mediaUrls[0] ? (
        <div className="relative h-20 w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: "16 / 9" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.mediaUrls[0]} alt="" className="size-full object-contain" />
          <span className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
            {post.mediaUrls.length}
          </span>
        </div>
      ) : (
        post.mediaUrl && (
          <div className="h-20 w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: "16 / 9" }}>
            {post.mediaType === "VIDEO" ? (
              <video src={post.mediaUrl} className="size-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrl} alt="" className="size-full object-contain" />
            )}
          </div>
        )
      )}
      {post.clientFeedback && (
        <p className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
          Kunde: {post.clientFeedback}
        </p>
      )}
      {post.publishError && <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{post.publishError}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {post.scheduledAt && (
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3" />
            {formatDate(post.scheduledAt)}
          </span>
        )}
        {post.responsibleName && (
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3" />
            {post.responsibleName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <SocialPostFormDialog organizationId={organizationId} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} post={post} />
          <button
            type="button"
            aria-label="Löschen"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Beitrag wirklich löschen?")) return;
              const fd = new FormData();
              fd.set("postId", post.id);
              startTransition(() => deleteSocialPost(fd));
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Column({ status, label, droppable, posts, children }: {
  status: BoardPost["status"];
  label: string;
  droppable: boolean;
  posts: BoardPost[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2.5 ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
        <span className="text-xs text-muted-foreground">{posts.length}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function SocialPostBoard({
  organizationId,
  posts,
  channels,
  pipelines,
  agencyUsers,
}: {
  organizationId: string;
  posts: BoardPost[];
  channels: Channel[];
  pipelines: Pipeline[];
  agencyUsers: AgencyUser[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const post = posts.find((p) => p.id === active.id);
    const nextStatus = String(over.id) as BoardPost["status"];
    if (!post || post.status === nextStatus) return;

    const formData = new FormData();
    formData.set("postId", post.id);
    formData.set("status", nextStatus);
    moveSocialPostStatus(formData).catch((error) => {
      window.alert(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    });
  }

  const activePost = activeId ? posts.find((p) => p.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <Column key={col.status} status={col.status} label={col.label} droppable={col.droppable} posts={posts.filter((p) => p.status === col.status)}>
            {posts
              .filter((p) => p.status === col.status)
              .map((post) => (
                <PostCard key={post.id} post={post} organizationId={organizationId} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
              ))}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activePost && (
          <div className="w-64 rounded-lg border bg-card p-2.5 text-sm shadow-lg">
            <p className="line-clamp-3">{activePost.caption}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
