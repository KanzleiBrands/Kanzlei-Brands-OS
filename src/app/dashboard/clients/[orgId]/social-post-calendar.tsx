"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { SocialPostFormDialog } from "./social-post-form-dialog";
import type { BoardPost } from "./social-post-board";

type Channel = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; displayName: string; active: boolean };
type Pipeline = { id: string; name: string };
type AgencyUser = { id: string; name: string };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function SocialPostCalendar({
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
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const postsByDay = useMemo(() => {
    const map = new Map<string, BoardPost[]>();
    for (const post of posts) {
      const iso = post.publishedAt ?? post.scheduledAt;
      if (!iso) continue;
      const key = dateKey(new Date(iso));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const today = dateKey(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium capitalize">{monthLabel}</p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div key={index} />;
          const key = dateKey(date);
          const dayPosts = postsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 ${key === today ? "border-primary" : ""}`}
            >
              <span className="text-xs text-muted-foreground">{date.getDate()}</span>
              {dayPosts.map((post) => (
                <SocialPostFormDialog
                  key={post.id}
                  organizationId={organizationId}
                  channels={channels}
                  pipelines={pipelines}
                  agencyUsers={agencyUsers}
                  post={post}
                  variant="calendarChip"
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
