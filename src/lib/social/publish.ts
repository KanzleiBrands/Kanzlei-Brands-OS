import type { Prisma } from "@prisma/client";
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
import { getValidLinkedInAccessToken } from "@/lib/linkedin/token";
import { appendUtmParams } from "@/lib/social/utm";

type PostWithChannel = Prisma.SocialPostGetPayload<{ include: { channel: true } }>;

/**
 * Publishes a single post via the adapter for its platform, updating its
 * status/publishError (and deactivating the channel on an outright token
 * rejection) either way. Never throws - shared by the due-posts cron batch
 * (publishDueSocialPosts) and the "Sofort veröffentlichen" action
 * (publishSocialPostById in src/lib/actions/social-posts.ts).
 */
async function publishOneSocialPost(post: PostWithChannel): Promise<{ success: boolean; error?: string }> {
  try {
    if (!post.channel || !post.channel.active) {
      throw new Error("Kein aktiver Kanal für diesen Beitrag verbunden.");
    }
    const accessToken =
      post.platform === "LINKEDIN" ? await getValidLinkedInAccessToken(post.channel) : decryptToken(post.channel.accessTokenEnc);
    const caption = appendUtmParams(post.caption, post.platform, post.id);
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
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", publishError: message } });

    // A token rejected outright (Graph 190 / LinkedIn 401) means the whole
    // channel needs reconnecting, not just this one post retried.
    const tokenRejected =
      (error instanceof MetaGraphError && error.graphErrorCode === 190) || (error instanceof LinkedInApiError && error.status === 401);
    if (post.channel && tokenRejected) {
      await prisma.socialChannel.update({
        where: { id: post.channel.id },
        data: { active: false, lastError: message },
      });
    }
    return { success: false, error: message };
  }
}

/**
 * Publishes every SCHEDULED post whose time has come - called from the
 * social-publish cron route.
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
    const result = await publishOneSocialPost(post);
    if (result.success) {
      published++;
    } else {
      failed++;
      errors.push(`${post.id}: ${result.error}`);
    }
  }

  return { published, failed, errors };
}

/** Publishes one specific post immediately, without waiting for the cron - powers "Sofort veröffentlichen" in the post editor. */
export async function publishSocialPostById(postId: string): Promise<{ success: boolean; error?: string }> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, include: { channel: true } });
  if (!post) return { success: false, error: "Beitrag nicht gefunden." };
  return publishOneSocialPost(post);
}
