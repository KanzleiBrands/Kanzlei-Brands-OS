import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";

// Same fixed App-level callback pattern as the leadgen webhook
// (src/app/api/webhooks/meta/leadgen/route.ts): one URL for every connected
// Page/Instagram account, authenticated via the shared verify token (GET)
// and HMAC signature (POST).
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type FacebookFeedCommentValue = {
  item: string;
  comment_id: string;
  post_id: string;
  parent_id?: string;
  verb: "add" | "edited" | "remove";
  created_time?: number;
  message?: string;
  from?: { id: string; name?: string };
};

type InstagramCommentValue = {
  id: string;
  text?: string;
  parent_id?: string;
  media?: { id: string };
  from?: { id: string; username?: string };
};

type MetaWebhookEntry<T> = { id: string; time: number; changes: { field: string; value: T }[] };
type MetaWebhookBody = {
  object: string;
  entry?: (MetaWebhookEntry<FacebookFeedCommentValue> | MetaWebhookEntry<InstagramCommentValue>)[];
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      try {
        if (body.object === "page" && change.field === "feed") {
          const value = change.value as FacebookFeedCommentValue;
          if (value.item === "comment") {
            await processFacebookComment(entry.id, value);
          }
        } else if (body.object === "instagram" && change.field === "comments") {
          await processInstagramComment(entry.id, change.value as InstagramCommentValue);
        }
      } catch (error) {
        console.error("[meta-comments-webhook] Failed to process change:", error);
      }
    }
  }

  // Meta only needs a fast 200 to consider delivery successful; per-comment
  // failures are logged instead of failing the whole batch.
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processFacebookComment(pageId: string, value: FacebookFeedCommentValue) {
  const channel = await prisma.socialChannel.findFirst({ where: { platform: "FACEBOOK", externalId: pageId } });
  if (!channel) return; // Not (or no longer) a Page we're connected to.

  const post = await prisma.socialPost.findFirst({ where: { channelId: channel.id, externalPostId: value.post_id } });
  if (!post) return; // Comment on a post we didn't create/track.

  if (value.verb === "remove") {
    await prisma.socialComment.deleteMany({ where: { postId: post.id, externalId: value.comment_id } });
    return;
  }

  await upsertComment({
    postId: post.id,
    externalId: value.comment_id,
    parentExternalId: value.parent_id,
    authorName: value.from?.name ?? "Unbekannt",
    isOwnReply: value.from?.id === channel.externalId,
    message: value.message ?? "",
    postedAt: value.created_time ? new Date(value.created_time * 1000) : new Date(),
  });
}

async function processInstagramComment(igUserId: string, value: InstagramCommentValue) {
  const channel = await prisma.socialChannel.findFirst({ where: { platform: "INSTAGRAM", externalId: igUserId } });
  if (!channel) return;

  const mediaId = value.media?.id;
  if (!mediaId) return;
  const post = await prisma.socialPost.findFirst({ where: { channelId: channel.id, externalPostId: mediaId } });
  if (!post) return;

  await upsertComment({
    postId: post.id,
    externalId: value.id,
    parentExternalId: value.parent_id,
    authorName: value.from?.username ?? "Unbekannt",
    isOwnReply: value.from?.id === channel.externalId,
    message: value.text ?? "",
    postedAt: new Date(),
  });
}

async function upsertComment(params: {
  postId: string;
  externalId: string;
  parentExternalId?: string;
  authorName: string;
  isOwnReply: boolean;
  message: string;
  postedAt: Date;
}) {
  let parentCommentId: string | undefined;
  if (params.parentExternalId) {
    const parent = await prisma.socialComment.findUnique({
      where: { postId_externalId: { postId: params.postId, externalId: params.parentExternalId } },
    });
    parentCommentId = parent?.id;
  }

  await prisma.socialComment.upsert({
    where: { postId_externalId: { postId: params.postId, externalId: params.externalId } },
    create: {
      postId: params.postId,
      externalId: params.externalId,
      authorName: params.authorName,
      message: params.message,
      isOwnReply: params.isOwnReply,
      parentCommentId,
      postedAt: params.postedAt,
    },
    update: { message: params.message, parentCommentId },
  });
}
