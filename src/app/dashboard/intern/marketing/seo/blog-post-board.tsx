"use client";

import { useState } from "react";
import { BlogPostEditorDialog } from "./blog-post-editor-dialog";

export type BlogPostItem = {
  id: string;
  status: "IDEA" | "IN_PRODUCTION" | "REVIEW" | "CHANGES_REQUESTED" | "SCHEDULED" | "PUBLISHED" | "FAILED";
  title: string | null;
  topic: string | null;
  ideaSourceLabel: string | null;
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  content: string | null;
  featuredImageUrl: string | null;
  reviewFeedback: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
};

const COLUMNS: { status: BlogPostItem["status"]; label: string }[] = [
  { status: "IDEA", label: "Idee" },
  { status: "IN_PRODUCTION", label: "In Produktion" },
  { status: "REVIEW", label: "Freigabe" },
  { status: "CHANGES_REQUESTED", label: "Änderung gewünscht" },
  { status: "SCHEDULED", label: "Geplant" },
  { status: "PUBLISHED", label: "Veröffentlicht" },
];

/**
 * Board für die Blog-/SEO-Pipeline - bewusst ohne Drag & Drop (anders als
 * social-post-board.tsx): Status wechseln passiert im Editor-Dialog über ein
 * einfaches Dropdown, das reicht für das v1-Beitragsvolumen eines einzelnen
 * internen Blogs. Spalten sind reine Listen, Klick auf eine Karte öffnet den
 * Editor (Text generieren, bearbeiten, freigeben, planen).
 */
export function BlogPostBoard({ posts, canManage }: { posts: BlogPostItem[]; canManage: boolean }) {
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openPostId) ?? null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const columnPosts = posts.filter((p) => p.status === col.status);
          return (
            <div key={col.status} className="flex w-64 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between px-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{col.label}</p>
                <span className="text-xs text-muted-foreground">{columnPosts.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {columnPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setOpenPostId(post.id)}
                    className="flex flex-col gap-1 rounded-md border bg-card p-2.5 text-left text-sm hover:border-primary"
                  >
                    <p className="font-medium">{post.title || "(ohne Titel)"}</p>
                    {post.targetKeyword && <p className="text-xs text-muted-foreground">Keyword: {post.targetKeyword}</p>}
                    {post.ideaSourceLabel && (
                      <p className="truncate text-[0.7rem] text-muted-foreground" title={post.ideaSourceLabel}>
                        Quelle: {post.ideaSourceLabel}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {openPost && (
        <BlogPostEditorDialog post={openPost} canManage={canManage} open={!!openPost} onOpenChange={(o) => !o && setOpenPostId(null)} />
      )}
    </>
  );
}
