import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { ContentTab } from "@/app/dashboard/clients/[orgId]/content-tab";

export default async function InternalSocialMediaPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;

  const [channels, posts, comments, pipelines, agencyUsers, contentFormats, organization] = await Promise.all([
    prisma.socialChannel.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
    prisma.socialPost.findMany({
      where: { organizationId },
      include: { responsible: { select: { name: true } }, contentFormat: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.socialComment.findMany({ where: { post: { organizationId } }, orderBy: { postedAt: "asc" } }),
    prisma.pipeline.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contentFormat.findMany({ orderBy: { name: "asc" } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { contentBrandDna: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Kanäle verbinden/trennen läuft jetzt zentral im{" "}
        <Link href="/dashboard/intern/marketing/integrations" className="underline underline-offset-2">
          Integrationen-Tab
        </Link>
        .
      </p>
      <ContentTab
      organizationId={organizationId}
      channels={channels}
      pipelines={pipelines}
      agencyUsers={agencyUsers}
      canManageChannels={session.user.role === "AGENCY_ADMIN"}
      canManageFormats={session.user.role === "AGENCY_ADMIN"}
      showChannelList={false}
      contentFormats={contentFormats}
      contentBrandDna={organization?.contentBrandDna ?? ""}
      posts={posts.map((post) => ({
        id: post.id,
        platform: post.platform,
        status: post.status,
        caption: post.caption,
        title: post.title,
        topic: post.topic,
        contentFormatId: post.contentFormatId,
        contentFormatName: post.contentFormat?.name ?? null,
        mediaUrl: post.mediaUrl,
        mediaUrls: post.mediaUrls,
        mediaType: post.mediaType,
        utmCampaign: post.utmCampaign,
        channelId: post.channelId,
        pipelineId: post.pipelineId,
        responsibleUserId: post.responsibleUserId,
        responsibleName: post.responsible?.name ?? null,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        publishedUrl: post.publishedUrl,
        clientFeedback: post.clientFeedback,
        publishError: post.publishError,
      }))}
      comments={comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        authorName: comment.authorName,
        authorAvatarUrl: comment.authorAvatarUrl,
        message: comment.message,
        isHidden: comment.isHidden,
        isOwnReply: comment.isOwnReply,
        parentCommentId: comment.parentCommentId,
        postedAt: comment.postedAt.toISOString(),
      }))}
      analyticsPosts={posts
        .filter((post) => post.status === "PUBLISHED" && post.publishedAt)
        .map((post) => ({
          id: post.id,
          platform: post.platform,
          caption: post.caption,
          publishedAt: post.publishedAt!.toISOString(),
          publishedUrl: post.publishedUrl,
          reach: post.reach,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          shareCount: post.shareCount,
          clickCount: post.clickCount,
        }))}
      />
    </div>
  );
}
