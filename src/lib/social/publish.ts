import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/auth-encryption";
import {
  publishFacebookPost,
  publishFacebookCarousel,
  publishInstagramPost,
  publishInstagramCarousel,
  MetaGraphError,
} from "@/lib/meta/graph";
import { publishLinkedInPost, LinkedInApiError } from "@/lib/linkedin/client";
import { appendUtmParams } from "@/lib/social/utm";

/**
 * Actually publishes every SCHEDULED post whose time has come, via the
 * adapter for its platform - called from the social-publish cron route.
 * Never throws: one broken channel/post shouldn't block the rest of the
 * batch, mirroring src/lib/mailbox/sync.ts#syncAllMailboxes.
 */
export async function publishDueSocialPosts(): Promise<{ published: number; failed: number; errors: string[] }> {
  const due = await prisma.socialPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { channel: true },
  });

  let published = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of due) {
    try {
      if (!post.channel || !post.channel.active) {
        throw new Error("Kein aktiver Kanal für diesen Beitrag verbunden.");
      }
      const accessToken = decryptToken(post.channel.accessTokenEnc);
      const caption = appendUtmParams(post.caption, post.platform, post.utmCampaign);
      const isCarousel = post.mediaType === "CAROUSEL" && post.mediaUrls.length > 0;
      let result: { id: string; permalink?: string };

      if (post.platform === "FACEBOOK") {
        result = isCarousel
          ? await publishFacebookCarousel({
              pageId: post.channel.externalId,
              pageAccessToken: accessToken,
              message: caption,
              mediaUrls: post.mediaUrls,
            })
          : await publishFacebookPost({
              pageId: post.channel.externalId,
              pageAccessToken: accessToken,
              message: caption,
              mediaUrl: post.mediaUrl ?? undefined,
              mediaType: post.mediaType === "CAROUSEL" ? undefined : (post.mediaType ?? undefined),
            });
      } else if (post.platform === "INSTAGRAM") {
        if (isCarousel) {
          result = await publishInstagramCarousel({
            igUserId: post.channel.externalId,
            pageAccessToken: accessToken,
            caption,
            mediaUrls: post.mediaUrls,
          });
        } else {
          if (!post.mediaUrl || !post.mediaType) throw new Error("Instagram-Beitrag benötigt ein Bild oder Video.");
          if (post.mediaType === "CAROUSEL") throw new Error("Karussell-Beitrag benötigt mindestens 2 Bilder.");
          result = await publishInstagramPost({
            igUserId: post.channel.externalId,
            pageAccessToken: accessToken,
            caption,
            mediaUrl: post.mediaUrl,
            mediaType: post.mediaType,
          });
        }
      } else {
        const linkedInResult = await publishLinkedInPost({
          accessToken,
          organizationUrn: post.channel.externalId,
          text: caption,
          mediaUrl: post.mediaUrl ?? undefined,
          mediaUrls: isCarousel ? post.mediaUrls : undefined,
          mediaType: post.mediaType ?? undefined,
        });
        result = { id: linkedInResult.id };
      }

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedUrl: result.permalink ?? null,
          externalPostId: result.id,
          publishError: null,
        },
      });
      published++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      errors.push(`${post.id}: ${message}`);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", publishError: message } });

      // A token rejected outright (Graph 190 / LinkedIn 401) means the whole
      // channel needs reconnecting, not just this one post retried.
      const tokenRejected =
        (error instanceof MetaGraphError && error.graphErrorCode === 190) ||
        (error instanceof LinkedInApiError && error.status === 401);
      if (post.channel && tokenRejected) {
        await prisma.socialChannel.update({
          where: { id: post.channel.id },
          data: { active: false, lastError: message },
        });
      }
    }
  }

  return { published, failed, errors };
}
