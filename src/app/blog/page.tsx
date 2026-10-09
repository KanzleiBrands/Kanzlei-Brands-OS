import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Blog | Kanzlei Brands",
  description: "Beiträge rund um Kanzlei-Marketing, Recruiting und Mandatsakquise.",
};

/**
 * Öffentliche Blog-Übersicht - Ersatz für die bisherige Webflow-Blog-Seite
 * (siehe BlogPost-Modell-Kommentar). Zeigt ausschließlich PUBLISHED-Beiträge,
 * neueste zuerst. Freigabe/Planung passiert im internen SEO/Blog-Reiter
 * (/dashboard/intern/marketing/seo), diese Seite liest nur.
 */
export default async function BlogIndexPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, metaDescription: true, topic: true, publishedAt: true, featuredImageUrl: true },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Blog</h1>
        <p className="text-muted-foreground">Beiträge rund um Kanzlei-Marketing, Recruiting und Mandatsakquise.</p>
      </div>

      {posts.length === 0 && <p className="text-muted-foreground">Noch keine Beiträge veröffentlicht.</p>}

      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <article key={post.slug} className="flex flex-col gap-1.5 border-b pb-6">
            <Link href={`/blog/${post.slug}`} className="text-xl font-medium underline-offset-4 hover:underline">
              {post.title}
            </Link>
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()} className="text-xs text-muted-foreground">
                {post.publishedAt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
              </time>
            )}
            <p className="text-sm text-muted-foreground">{post.metaDescription ?? post.topic}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
