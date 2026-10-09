import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { isDataForSeoConfigured } from "@/lib/dataforseo/client";
import { SeoBlogTab } from "./seo-blog-tab";

/**
 * SEO/GEO-Blog-Pipeline (v1, nur intern) - "neben Social Media" wie vom
 * Nutzer gewünscht, siehe marketing-tabs.tsx. Ersetzt byclaire.co: Content-
 * Lücken aus der eigenen Google-Search-Console (kostenlos, keine bezahlte
 * Keyword-API), KI-Ideen- und Artikel-Generierung, Freigabe-Workflow wie bei
 * Social Media Content, Veröffentlichung direkt in dieser App unter /blog
 * (siehe src/app/blog) statt des bisherigen Webflow-Blogs.
 */
export default async function SeoBlogPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const [posts, gaps, backlinks, backlinkProfile, competitorDomains, competitorGaps, gscConnection, platformSettings] = await Promise.all([
    prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.seoContentGap.findMany({ where: { status: "NEW" }, orderBy: { impressions: "desc" }, take: 50 }),
    prisma.seoBacklink.findMany({ orderBy: { addedAt: "desc" } }),
    prisma.seoBacklinkProfile.findUnique({ where: { id: "singleton" } }),
    prisma.seoCompetitorDomain.findMany({ orderBy: { addedAt: "desc" } }),
    prisma.seoCompetitorKeywordGap.findMany({
      where: { status: "NEW" },
      orderBy: { searchVolume: "desc" },
      take: 50,
      include: { competitorDomain: true },
    }),
    prisma.googleSearchConsoleConnection.findUnique({ where: { id: "singleton" } }),
    prisma.platformSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <SeoBlogTab
      canManage={session.user.role === "AGENCY_ADMIN"}
      posts={posts.map((post) => ({
        id: post.id,
        status: post.status,
        title: post.title,
        topic: post.topic,
        ideaSourceLabel: post.ideaSourceLabel,
        slug: post.slug,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        targetKeyword: post.targetKeyword,
        content: post.content,
        featuredImageUrl: post.featuredImageUrl,
        reviewFeedback: post.reviewFeedback,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
      }))}
      gaps={gaps.map((gap) => ({
        id: gap.id,
        query: gap.query,
        clicks: gap.clicks,
        impressions: gap.impressions,
        ctr: gap.ctr,
        avgPosition: gap.avgPosition,
        searchVolume: gap.searchVolume,
      }))}
      backlinks={backlinks.map((b) => ({ id: b.id, domain: b.domain, url: b.url, status: b.status, note: b.note }))}
      backlinkProfile={
        backlinkProfile
          ? {
              domain: backlinkProfile.domain,
              rank: backlinkProfile.rank,
              backlinks: backlinkProfile.backlinks,
              referringDomains: backlinkProfile.referringDomains,
              brokenBacklinks: backlinkProfile.brokenBacklinks,
              fetchedAt: backlinkProfile.fetchedAt?.toISOString() ?? null,
              fetchError: backlinkProfile.fetchError,
            }
          : null
      }
      competitorDomains={competitorDomains.map((d) => ({ id: d.id, domain: d.domain, label: d.label }))}
      competitorGaps={competitorGaps.map((gap) => ({
        id: gap.id,
        competitorDomain: gap.competitorDomain.domain,
        keyword: gap.keyword,
        searchVolume: gap.searchVolume,
        competitorPosition: gap.competitorPosition,
        ourPosition: gap.ourPosition,
      }))}
      gsc={{
        connected: !!gscConnection,
        siteUrl: gscConnection?.siteUrl ?? null,
        lastSyncedAt: gscConnection?.lastSyncedAt?.toISOString() ?? null,
        lastSyncError: gscConnection?.lastSyncError ?? null,
      }}
      dataForSeo={{
        configured: isDataForSeoConfigured(),
        enabled: platformSettings?.dataForSeoEnabled ?? false,
        targetDomain: platformSettings?.dataForSeoTargetDomain ?? null,
        lastSyncedAt: platformSettings?.dataForSeoLastSyncedAt?.toISOString() ?? null,
        lastSyncError: platformSettings?.dataForSeoLastSyncError ?? null,
      }}
    />
  );
}
