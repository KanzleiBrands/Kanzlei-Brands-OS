-- LinkedIn access tokens expire after 60 days; a refresh token (once the
-- app has an API product with 1-year token refresh, e.g. Community
-- Management API / Advertising API) keeps the connection alive for up to
-- 365 days without re-login. Meta channels leave these columns null - their
-- Page access tokens are already long-lived.

-- AlterTable
ALTER TABLE "SocialChannel" ADD COLUMN     "refreshTokenEnc" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3);
