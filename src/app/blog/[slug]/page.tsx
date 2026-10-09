import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";

async function getPost(slug: string) {
  return prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED" } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.metaTitle ?? post.title ?? undefined,
    description: post.metaDescription ?? undefined,
    openGraph: {
      title: post.metaTitle ?? post.title ?? undefined,
      description: post.metaDescription ?? undefined,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
      type: "article",
    },
  };
}

/**
 * Öffentliche Beitragsseite - Ersatz für die bisherige Webflow-Blog-Seite.
 * JSON-LD Article-Schema fürs "GEO"-Ziel (KI-Antworten/Google AI sollen den
 * Beitrag als konkrete, zitierbare Quelle erkennen können), siehe
 * byclaire.co-Recherche in der Session.
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.content) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? undefined,
    image: post.featuredImageUrl ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "Kanzlei Brands" },
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{post.title}</h1>
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()} className="text-xs text-muted-foreground">
              {post.publishedAt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
            </time>
          )}
        </header>
        {post.featuredImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImageUrl} alt="" className="w-full rounded-lg object-cover" />
        )}
        <div className="flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
