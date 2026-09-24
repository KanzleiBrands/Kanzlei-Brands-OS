-- CreateTable
CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "message" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isOwnReply" BOOLEAN NOT NULL DEFAULT false,
    "parentCommentId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialComment_postId_idx" ON "SocialComment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialComment_postId_externalId_key" ON "SocialComment"("postId", "externalId");

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
