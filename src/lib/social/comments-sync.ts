import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/auth-encryption";
import { listFacebookComments, listInstagramComments, MetaGraphError, type MetaComment } from "@/lib/meta/graph";

/**
 * Polling backfill for comments, on top of the real-time webhook
 * (src/app/api/webhooks/meta/comments/route.ts): catches anything a missed
 * or delayed webhook delivery would otherwise lose, and picks up comments on
 * posts published before a channel was subscribed. Never throws - one
 * broken channel/post shouldn't block the rest of the batch, mirroring
 * src/lib/social/publish.ts.
 */
export async function syncAllSocialComments(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const channels = await prisma.socialChannel.findMany({
    where: { active: true, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
    include: {
      posts: { where: { status: "PUBLISHED", externalPostId: { not: null } } },
    },
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    const accessToken = decryptToken(channel.accessTokenEnc);
    for (const post of channel.posts) {
      if (!post.externalPostId) continue;
      try {
        const comments =
          channel.platform === "FACEBOOK"
            ? await listFacebookComments(post.externalPostId, accessToken)
            : await listInstagramComments(post.externalPostId, accessToken);

        for (const comment of comments) {
          await upsertSyncedComment(post.id, channel.externalId, comment);
        }
        synced++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "Unbekannter Fehler";
        errors.push(`${post.id}: ${message}`);
        if (error instanceof MetaGraphError && error.graphErrorCode === 190) {
          await prisma.socialChannel.update({
            where: { id: channel.id },
            data: { active: false, lastError: "Zugriff abgelaufen - bitte erneut verbinden." },
          });
        }
      }
    }
  }

  return { synced, failed, errors };
}

async function upsertSyncedComment(postId: string, channelExternalId: string, comment: MetaComment) {
  let parentCommentId: string | undefined;
  if (comment.parent?.id) {
    const parent = await prisma.socialComment.findUnique({
      where: { postId_externalId: { postId, externalId: comment.parent.id } },
    });
    parentCommentId = parent?.id;
  }

  await prisma.socialComment.upsert({
    where: { postId_externalId: { postId, externalId: comment.id } },
    create: {
      postId,
      externalId: comment.id,
      authorName: comment.from?.name ?? comment.from?.username ?? "Unbekannt",
      message: comment.message,
      isOwnReply: comment.from?.id === channelExternalId,
      parentCommentId,
      postedAt: new Date(comment.created_time),
    },
    update: { message: comment.message, parentCommentId },
  });
}
