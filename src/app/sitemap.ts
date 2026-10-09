import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const PRODUCTION_URL = "https://app.kanzlei-brands.de";

/** Next.js-eigene sitemap.xml - listet die öffentliche Blog-Übersicht + alle veröffentlichten Beiträge (siehe src/app/blog). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: `${PRODUCTION_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${PRODUCTION_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
