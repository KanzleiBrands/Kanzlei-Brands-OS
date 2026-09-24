"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SocialChannelList } from "./social-channel-list";
import { SocialPostFormDialog } from "./social-post-form-dialog";
import { SocialPostBoard, type BoardPost } from "./social-post-board";
import { SocialPostCalendar } from "./social-post-calendar";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };

export function ContentTab({
  organizationId,
  channels,
  posts,
  pipelines,
  agencyUsers,
}: {
  organizationId: string;
  channels: Channel[];
  posts: BoardPost[];
  pipelines: Pipeline[];
  agencyUsers: AgencyUser[];
}) {
  const [view, setView] = useState<"board" | "calendar">("board");

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
        </div>
        <SocialPostFormDialog organizationId={organizationId} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
      </div>

      {view === "board" ? (
        <SocialPostBoard organizationId={organizationId} posts={posts} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
      ) : (
        <SocialPostCalendar organizationId={organizationId} posts={posts} channels={channels} pipelines={pipelines} agencyUsers={agencyUsers} />
      )}
    </div>
  );
}
