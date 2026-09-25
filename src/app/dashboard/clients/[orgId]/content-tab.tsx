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

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };

export function ContentTab({
  organizationId,
  channels,
  posts,
  pipelines,
  agencyUsers,
  comments,
  analyticsPosts,
}: {
  organizationId: string;
  channels: Channel[];
  posts: BoardPost[];
  pipelines: Pipeline[];
  agencyUsers: AgencyUser[];
  comments: CommentInboxComment[];
  analyticsPosts: AnalyticsPost[];
}) {
  const [view, setView] = useState<"board" | "calendar" | "community" | "analytics">("board");
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
      <SocialChannelList organizationId={organizationId} channels={channels} />

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
        </div>
        <div className="flex gap-1.5">
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
    </div>
  );
}
