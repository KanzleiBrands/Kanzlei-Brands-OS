"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";
import { decryptToken } from "@/lib/auth-encryption";
import {
  replyToFacebookComment,
  replyToInstagramComment,
  setFacebookCommentHidden,
  setInstagramCommentHidden,
  deleteMetaComment,
} from "@/lib/meta/graph";
import { replyToLinkedInComment, deleteLinkedInComment } from "@/lib/linkedin/client";

async function loadCommentWithChannel(commentId: string) {
  const comment = await prisma.socialComment.findUnique({
    where: { id: commentId },
    include: { post: { include: { channel: true } } },
  });
  if (!comment) throw new Error("Kommentar nicht gefunden.");
  if (!comment.post.channel) throw new Error("Kein Kanal für diesen Beitrag verbunden.");
  return { comment, post: comment.post, channel: comment.post.channel };
}

export async function replySocialComment(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const commentId = String(formData.get("commentId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return "Bitte eine Antwort eingeben.";

  try {
    const { comment, post, channel } = await loadCommentWithChannel(commentId);
    await assertCanManageSocialContentFor(session, post.organizationId);
    const accessToken = decryptToken(channel.accessTokenEnc);

    let externalId: string;
    if (post.platform === "FACEBOOK") {
      externalId = (await replyToFacebookComment(comment.externalId, accessToken, message)).id;
    } else if (post.platform === "INSTAGRAM") {
      externalId = (await replyToInstagramComment(comment.externalId, accessToken, message)).id;
    } else {
      externalId = (await replyToLinkedInComment(comment.externalId, accessToken, message)).id;
    }

    await prisma.socialComment.create({
      data: {
        postId: post.id,
        externalId,
        authorName: channel.displayName,
        message,
        isOwnReply: true,
        parentCommentId: comment.id,
        postedAt: new Date(),
      },
    });
  } catch (error) {
    return error instanceof Error ? error.message : "Antwort konnte nicht gesendet werden.";
  }

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/intern/marketing/social");
  return undefined;
}

async function setCommentHidden(commentId: string, hidden: boolean) {
  const session = await requireSession();

  const { comment, post, channel } = await loadCommentWithChannel(commentId);
  await assertCanManageSocialContentFor(session, post.organizationId);
  const accessToken = decryptToken(channel.accessTokenEnc);

  if (post.platform === "FACEBOOK") {
    await setFacebookCommentHidden(comment.externalId, accessToken, hidden);
  } else if (post.platform === "INSTAGRAM") {
    await setInstagramCommentHidden(comment.externalId, accessToken, hidden);
  } else {
    throw new Error("Kommentare auf LinkedIn können noch nicht verborgen werden.");
  }

  await prisma.socialComment.update({ where: { id: commentId }, data: { isHidden: hidden } });
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/intern/marketing/social");
}

export async function hideSocialComment(formData: FormData) {
  await setCommentHidden(String(formData.get("commentId") ?? ""), true);
}

export async function unhideSocialComment(formData: FormData) {
  await setCommentHidden(String(formData.get("commentId") ?? ""), false);
}

export async function deleteSocialComment(formData: FormData) {
  const session = await requireSession();

  const commentId = String(formData.get("commentId") ?? "");
  const { comment, post, channel } = await loadCommentWithChannel(commentId);
  await assertCanManageSocialContentFor(session, post.organizationId);
  const accessToken = decryptToken(channel.accessTokenEnc);

  if (post.platform === "FACEBOOK" || post.platform === "INSTAGRAM") {
    await deleteMetaComment(comment.externalId, accessToken);
  } else {
    await deleteLinkedInComment(comment.externalId, accessToken);
  }

  await prisma.socialComment.delete({ where: { id: commentId } });
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/intern/marketing/social");
}
