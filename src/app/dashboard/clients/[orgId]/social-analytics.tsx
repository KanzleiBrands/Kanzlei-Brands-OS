"use client";

import { useMemo, useState } from "react";
import { PlatformIcon } from "@/components/platform-icon";
import { StatTile } from "@/components/stat-tile";

export type AnalyticsPost = {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  caption: string;
  publishedAt: string; // ISO
  publishedUrl: string | null;
  reach: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  clickCount: number | null;
};

type WeekPoint = { weekStart: Date; count: number };

const CHART_WIDTH = 640;
const CHART_HEIGHT = 160;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;

function TrendChart({ points }: { points: WeekPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD_LEFT + i * stepX,
    y: PAD_TOP + innerHeight - (p.count / maxValue) * innerHeight,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const baseline = PAD_TOP + innerHeight;
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`
      : "";

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const active = hoverIndex !== null ? coords[hoverIndex] : null;
  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <line x1={PAD_LEFT} y1={baseline} x2={CHART_WIDTH - PAD_RIGHT} y2={baseline} stroke="currentColor" strokeWidth={1} className="text-border" />
        {areaPath && <path d={areaPath} fill="currentColor" className="text-primary/10" />}
        {linePath && (
          <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
        )}
        {active && (
          <>
            <line x1={active.x} y1={PAD_TOP} x2={active.x} y2={baseline} stroke="currentColor" strokeWidth={1} className="text-muted-foreground/40" />
            <circle cx={active.x} cy={active.y} r={4} fill="currentColor" className="text-primary" />
          </>
        )}
      </svg>
      {active && activePoint && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-md"
          style={{ left: `${(active.x / CHART_WIDTH) * 100}%`, top: `${(active.y / CHART_HEIGHT) * 100}%` }}
        >
          <p className="font-medium">{activePoint.count} Beitrag{activePoint.count === 1 ? "" : "e"}</p>
          <p className="text-muted-foreground">
            Woche ab {activePoint.weekStart.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
          </p>
        </div>
      )}
    </div>
  );
}

function formatMetric(value: number | null): string {
  return value === null ? "–" : value.toLocaleString("de-DE");
}

export function SocialAnalytics({ posts }: { posts: AnalyticsPost[] }) {
  // Frozen once per mount instead of read fresh on every render, so the
  // component stays pure (see react-hooks/purity) - the trend/30-day window
  // only needs to be "as of when this view opened", not live-ticking.
  const [now] = useState(() => Date.now());

  const weeklyTrend = useMemo<WeekPoint[]>(() => {
    const weeks: WeekPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = now - i * 7 * 24 * 60 * 60 * 1000;
      const start = end - 7 * 24 * 60 * 60 * 1000;
      const count = posts.filter((p) => {
        const t = new Date(p.publishedAt).getTime();
        return t > start && t <= end;
      }).length;
      weeks.push({ weekStart: new Date(start), count });
    }
    return weeks;
  }, [posts, now]);

  const totalReach = posts.reduce((sum, p) => sum + (p.reach ?? 0), 0);
  const totalEngagement = posts.reduce((sum, p) => sum + (p.likeCount ?? 0) + (p.commentCount ?? 0) + (p.shareCount ?? 0), 0);
  const totalClicks = posts.reduce((sum, p) => sum + (p.clickCount ?? 0), 0);
  const last30Days = posts.filter((p) => now - new Date(p.publishedAt).getTime() < 30 * 24 * 60 * 60 * 1000).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Veröffentlicht (30 Tage)" value={last30Days} subtext={`${posts.length} insgesamt`} />
        <StatTile label="Reichweite gesamt" value={totalReach.toLocaleString("de-DE")} subtext="Facebook & Instagram" />
        <StatTile label="Interaktionen gesamt" value={totalEngagement.toLocaleString("de-DE")} subtext="Likes, Kommentare, Shares" />
        <StatTile label="Klicks gesamt" value={totalClicks.toLocaleString("de-DE")} subtext="Facebook" />
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Veröffentlichungstrend (letzte 12 Wochen)</p>
        {posts.length > 0 ? (
          <TrendChart points={weeklyTrend} />
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine veröffentlichten Beiträge.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Beitrag</th>
              <th className="px-3 py-2 text-left">Veröffentlicht</th>
              <th className="px-3 py-2 text-right">Reichweite</th>
              <th className="px-3 py-2 text-right">Likes</th>
              <th className="px-3 py-2 text-right">Kommentare</th>
              <th className="px-3 py-2 text-right">Shares</th>
              <th className="px-3 py-2 text-right">Klicks</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={post.platform} />
                    {post.publishedUrl ? (
                      <a href={post.publishedUrl} target="_blank" rel="noreferrer" className="line-clamp-1 max-w-60 hover:underline">
                        {post.caption}
                      </a>
                    ) : (
                      <span className="line-clamp-1 max-w-60">{post.caption}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {new Date(post.publishedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetric(post.reach)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetric(post.likeCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetric(post.commentCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetric(post.shareCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetric(post.clickCount)}</td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Noch keine veröffentlichten Beiträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
