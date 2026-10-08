"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SocialChannelList } from "./social-channel-list";
import { SocialPostFormDialog } from "./social-post-form-dialog";
import { SocialPostBoard, type BoardPost } from "./social-post-board";
import { SocialPostCalendar } from "./social-post-calendar";
import { SocialCommentInbox, type CommentInboxPost, type CommentInboxComment } from "./social-comment-inbox";
import { SocialCsvImportDialog } from "./social-csv-import-dialog";
import { SocialAnalytics, type AnalyticsPost } from "./social-analytics";
import { GenerateContentIdeasDialog } from "./generate-content-ideas-dialog";
import { ContentFormatManager, type ContentFormatItem } from "./content-format-manager";
import { ContentConfigPanel } from "./content-config-panel";
import { type ContentIntentionValue } from "./content-config-form";
import { type ContentReferenceDocItem } from "./content-reference-docs-list";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };
type View = "board" | "calendar" | "community" | "analytics" | "config";

export function ContentTab({
  organizationId,
  channels,
  posts,
  pipelines,
  agencyUsers,
  comments,
  analyticsPosts,
  contentFormats,
  contentBrandDna,
  contentWebsiteUrl,
  contentIntention,
  contentReferenceDocs,
  socialContentBooked,
  canManageChannels = true,
  canManageFormats = true,
  showChannelList = true,
}: {
  organizationId: string;
  channels: Channel[];
  posts: BoardPost[];
  pipelines: Pipeline[];
  agencyUsers: AgencyUser[];
  comments: CommentInboxComment[];
  analyticsPosts: AnalyticsPost[];
  contentFormats: ContentFormatItem[];
  contentBrandDna: string;
  contentWebsiteUrl: string;
  contentIntention: ContentIntentionValue | null;
  contentReferenceDocs: ContentReferenceDocItem[];
  /** null im internen Marketing-Center, wo "für diesen Kunden gebucht" kein Konzept ist. */
  socialContentBooked: boolean | null;
  /** Kanäle verbinden/trennen bleibt Admin-Sache - siehe SocialChannelList. */
  canManageChannels?: boolean;
  /** Format-Bibliothek verwalten ist Admin-Sache - siehe requireAgencyAdmin in content-formats.ts. */
  canManageFormats?: boolean;
  /** false im internen Marketing-Center - dort lebt die Kanal-Verwaltung im Integrationen-Tab. */
  showChannelList?: boolean;
}) {
  const [view, setView] = useState<View>("board");
  const commentInboxPosts: CommentInboxPost[] = posts.map((post) => ({
    id: post.id,
    platform: post.platform,
    caption: post.caption,
    mediaUrl: post.mediaUrl,
    publishedAt: post.publishedAt,
    publishedUrl: post.publishedUrl,
  }));

  return (
    <div className="flex flex-col gap-4">
      {showChannelList && <SocialChannelList organizationId={organizationId} channels={channels} canManage={canManageChannels} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button type="button" size="sm" variant={view === "calendar" ? "default" : "outline"} onClick={() => setView("calendar")}>
            Kalender
          </Button>
          <Button type="button" size="sm" variant={view === "community" ? "default" : "outline"} onClick={() => setView("community")}>
            Community
          </Button>
          <Button type="button" size="sm" variant={view === "analytics" ? "default" : "outline"} onClick={() => setView("analytics")}>
            Analytics
          </Button>
          <Button type="button" size="sm" variant={view === "config" ? "default" : "outline"} onClick={() => setView("config")}>
            Konfiguration
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {canManageFormats && <ContentFormatManager formats={contentFormats} />}
          <GenerateContentIdeasDialog organizationId={organizationId} formats={contentFormats.map((f) => ({ id: f.id, name: f.name }))} />
          <SocialCsvImportDialog organizationId={organizationId} />
          <SocialPostFormDialog organizationId={organizationId} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
        </div>
      </div>

      {view === "board" && (
        <SocialPostBoard organizationId={organizationId} posts={posts} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
      )}
      {view === "calendar" && (
        <SocialPostCalendar organizationId={organizationId} posts={posts} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
      )}
      {view === "community" && <SocialCommentInbox organizationId={organizationId} posts={commentInboxPosts} comments={comments} />}
      {view === "analytics" && <SocialAnalytics posts={analyticsPosts} />}
      {view === "config" && (
        <ContentConfigPanel
          organizationId={organizationId}
          websiteUrl={contentWebsiteUrl}
          brandDna={contentBrandDna}
          intention={contentIntention}
          referenceDocs={contentReferenceDocs}
          socialContentBooked={socialContentBooked}
        />
      )}
    </div>
  );
}
