import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
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

  const [posts, gaps, backlinks, gscConnection] = await Promise.all([
    prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.seoContentGap.findMany({ where: { status: "NEW" }, orderBy: { impressions: "desc" }, take: 50 }),
    prisma.seoBacklink.findMany({ orderBy: { addedAt: "desc" } }),
    prisma.googleSearchConsoleConnection.findUnique({ where: { id: "singleton" } }),
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
      }))}
      backlinks={backlinks.map((b) => ({ id: b.id, domain: b.domain, url: b.url, status: b.status, note: b.note }))}
      gsc={{
        connected: !!gscConnection,
        siteUrl: gscConnection?.siteUrl ?? null,
        lastSyncedAt: gscConnection?.lastSyncedAt?.toISOString() ?? null,
        lastSyncError: gscConnection?.lastSyncError ?? null,
      }}
    />
  );
}
