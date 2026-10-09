"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BlogPostBoard, type BlogPostItem } from "./blog-post-board";
import { BlogGenerateIdeasDialog } from "./blog-generate-ideas-dialog";
import { SeoGapsList, type SeoContentGapItem } from "./seo-gaps-list";
import { SeoBacklinksList, type SeoBacklinkItem, type SeoBacklinkProfileItem } from "./seo-backlinks-list";
import { SeoCompetitorGapsList, type SeoCompetitorDomainItem, type SeoCompetitorGapItem } from "./seo-competitor-gaps-list";
import { GscConnectionPanel } from "./gsc-connection-panel";
import { GscConnectStatus } from "./gsc-connect-status";
import { DataForSeoConfigPanel, type DataForSeoState } from "./dataforseo-config-panel";

type View = "board" | "gaps" | "competitors" | "backlinks" | "config";

/**
 * SEO/GEO-Blog-Pipeline (v1) - Ersatz für byclaire.co, siehe page.tsx für den
 * Kontext. Gleicher view-Switcher-Aufbau wie content-tab.tsx (Social Media),
 * aber eigenständige Komponenten statt Wiederverwendung, da Blogartikel
 * strukturell anders sind (Volltext + SEO-Metadaten statt kurzer Social-Caption).
 */
export function SeoBlogTab({
  canManage,
  posts,
  gaps,
  backlinks,
  backlinkProfile,
  competitorDomains,
  competitorGaps,
  gsc,
  dataForSeo,
}: {
  canManage: boolean;
  posts: BlogPostItem[];
  gaps: SeoContentGapItem[];
  backlinks: SeoBacklinkItem[];
  backlinkProfile: SeoBacklinkProfileItem;
  competitorDomains: SeoCompetitorDomainItem[];
  competitorGaps: SeoCompetitorGapItem[];
  gsc: { connected: boolean; siteUrl: string | null; lastSyncedAt: string | null; lastSyncError: string | null };
  dataForSeo: DataForSeoState;
}) {
  const [view, setView] = useState<View>("board");

  return (
    <div className="flex flex-col gap-4">
      <GscConnectStatus />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button type="button" size="sm" variant={view === "gaps" ? "default" : "outline"} onClick={() => setView("gaps")}>
            Content-Lücken {gaps.length > 0 && `(${gaps.length})`}
          </Button>
          <Button type="button" size="sm" variant={view === "competitors" ? "default" : "outline"} onClick={() => setView("competitors")}>
            Konkurrenz {competitorGaps.length > 0 && `(${competitorGaps.length})`}
          </Button>
          <Button type="button" size="sm" variant={view === "backlinks" ? "default" : "outline"} onClick={() => setView("backlinks")}>
            Backlinks
          </Button>
          <Button type="button" size="sm" variant={view === "config" ? "default" : "outline"} onClick={() => setView("config")}>
            Konfiguration
          </Button>
        </div>
        {canManage && <BlogGenerateIdeasDialog />}
      </div>

      {view === "board" && <BlogPostBoard posts={posts} canManage={canManage} />}
      {view === "gaps" && <SeoGapsList gaps={gaps} />}
      {view === "competitors" && <SeoCompetitorGapsList domains={competitorDomains} gaps={competitorGaps} />}
      {view === "backlinks" && <SeoBacklinksList backlinks={backlinks} profile={backlinkProfile} />}
      {view === "config" && (
        <div className="flex max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Google Search Console</p>
            <GscConnectionPanel gsc={gsc} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">DataForSEO (Suchvolumen, Konkurrenz, Backlinks)</p>
            <DataForSeoConfigPanel state={dataForSeo} />
          </div>
        </div>
      )}
    </div>
  );
}
