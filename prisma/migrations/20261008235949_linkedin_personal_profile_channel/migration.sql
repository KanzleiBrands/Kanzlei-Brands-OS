-- CreateEnum
CREATE TYPE "LinkedInChannelKind" AS ENUM ('ORGANIZATION', 'PERSONAL');

-- AlterTable
ALTER TABLE "SocialChannel" ADD COLUMN     "linkedInKind" "LinkedInChannelKind";

-- Alle bisher verbundenen LinkedIn-Kanäle waren Unternehmensseiten - das neue
-- Feld existiert erst ab jetzt (persönliche Profile), siehe social-post-form-dialog.tsx.
UPDATE "SocialChannel" SET "linkedInKind" = 'ORGANIZATION' WHERE "platform" = 'LINKEDIN';
