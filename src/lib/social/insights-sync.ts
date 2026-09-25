import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/auth-encryption";
import { fetchFacebookPostInsights, fetchInstagramMediaInsights, MetaGraphError } from "@/lib/meta/graph";

/**
 * Refreshes reach/impressions/likes/comments/shares/clicks for every
 * published Facebook/Instagram post, powering the Analytics view. LinkedIn
 * has no equivalent read-back API available to this app (same partnership
 * gate as its posting/comments APIs), so LinkedIn posts are skipped - their
 * status stays visible, just without performance numbers. Never throws -
 * one broken post shouldn't block the rest of the batch, mirroring
 * src/lib/social/publish.ts and comments-sync.ts.
 */
export async function syncSocialInsights(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const posts = await prisma.socialPost.findMany({
    where: { status: "PUBLISHED", externalPostId: { not: null }, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
    include: { channel: true },
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of posts) {
    if (!post.channel || !post.externalPostId) continue;
    try {
      const accessToken = decryptToken(post.channel.accessTokenEnc);
      const insights =
        post.platform === "FACEBOOK"
          ? await fetchFacebookPostInsights(post.externalPostId, accessToken)
          : await fetchInstagramMediaInsights(post.externalPostId, accessToken);

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          impressions: insights.impressions ?? null,
          reach: insights.reach ?? null,
          likeCount: insights.likeCount ?? null,
          commentCount: insights.commentCount ?? null,
          shareCount: insights.shareCount ?? null,
          clickCount: insights.clickCount ?? null,
          insightsSyncedAt: new Date(),
        },
      });
      synced++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      errors.push(`${post.id}: ${message}`);
      if (error instanceof MetaGraphError && error.graphErrorCode === 190) {
        await prisma.socialChannel.update({
          where: { id: post.channel.id },
          data: { active: false, lastError: "Zugriff abgelaufen - bitte erneut verbinden." },
        });
      }
    }
  }

  return { synced, failed, errors };
}
