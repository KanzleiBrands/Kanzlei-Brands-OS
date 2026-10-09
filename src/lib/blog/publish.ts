import { prisma } from "@/lib/prisma";

/**
 * Veröffentlicht fällige, bereits freigegebene Blogartikel - analog
 * publishDueSocialPosts (src/lib/social/publish.ts). Hier reicht ein reiner
 * Status-/Zeitstempel-Wechsel: der Artikel ist schon in dieser App
 * gespeichert, "veröffentlichen" bedeutet nur, dass /blog/[slug] ihn ab jetzt
 * ausliefert (siehe src/app/blog/[slug]/page.tsx), kein externer API-Call
 * nötig wie bei Social-Media-Plattformen.
 */
export async function publishDueBlogPosts(): Promise<{ published: number }> {
  const due = await prisma.blogPost.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } } });
  let published = 0;
  for (const post of due) {
    try {
      await prisma.blogPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      published++;
    } catch (error) {
      console.error("[blog] Veröffentlichung fehlgeschlagen", post.id, error);
    }
  }
  return { published };
}
