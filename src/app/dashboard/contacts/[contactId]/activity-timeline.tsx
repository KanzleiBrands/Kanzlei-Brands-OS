"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type Activity = {
  id: string;
  type: string;
  content: string | null;
  createdAt: string;
  userName: string | null;
};

const TABS: { key: string; label: string; types?: string[] }[] = [
  { key: "all", label: "Alle" },
  { key: "notes", label: "Notizen", types: ["NOTE"] },
  { key: "emails", label: "E-Mails", types: ["EMAIL_IN", "EMAIL_OUT"] },
  { key: "calls", label: "Anrufe", types: ["CALL"] },
  { key: "changes", label: "Status", types: ["STAGE_CHANGE"] },
];

const TYPE_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NOTE: { label: "Notiz", variant: "secondary" },
  STAGE_CHANGE: { label: "Status", variant: "outline" },
  EMAIL_IN: { label: "E-Mail (eingehend)", variant: "default" },
  EMAIL_OUT: { label: "E-Mail (ausgehend)", variant: "default" },
  CALL: { label: "Anruf", variant: "destructive" },
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const [tab, setTab] = useState("all");
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const filtered = activeTab.types ? activities.filter((a) => activeTab.types!.includes(a.type)) : activities;

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm ${
              tab === t.key
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {filtered.map((activity) => {
          const meta = TYPE_META[activity.type] ?? { label: activity.type, variant: "outline" as const };
          return (
            <div key={activity.id} className="border-b pb-2 text-sm last:border-0">
              <div className="flex items-center justify-between">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">{activity.createdAt}</span>
              </div>
              {activity.content && <p className="mt-1 text-muted-foreground">{activity.content}</p>}
              {activity.userName && <p className="text-xs text-muted-foreground">von {activity.userName}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Keine Einträge.</p>}
      </div>
    </div>
  );
}
