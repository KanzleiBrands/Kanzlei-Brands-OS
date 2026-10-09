import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { SOCIAL_CONTENT_PRODUCT_TAG } from "@/lib/social-content/constants";
import { SocialContentSection, type ClientSocialPost } from "../hub/social-content-section";
import { SocialContentPaywall } from "./social-content-paywall";

/**
 * Kundenseitige Social-Media-Content-Seite - eigener Reiter in der Sidebar
 * (siehe navFor in dashboard/layout.tsx), damit die Plattform das Angebot
 * aktiv zeigt statt es nur innerhalb der Übersicht zu verstecken. Per
 * Paywall gebunden an SOCIAL_CONTENT_PRODUCT_TAG (Organization.bookedProductTags),
 * analog zur E-Mail-Marketing-Paywall (siehe email-marketing-tab.tsx).
 *
 * Rein kundenseitig - zeigt NIE Admin-Controls (auch nicht während einer
 * Agentur-Impersonation): das Freischalten/"gebucht"-Setzen passiert
 * ausschließlich in der Agentur-Ansicht auf
 * /dashboard/clients/[orgId]?tab=content (Konfiguration-Reiter), die ein
 * echter Kunde nie erreichen kann (siehe assertCanManageSocialContentFor).
 */
export default async function SocialContentPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { bookedProductTags: true },
  });
  const booked = organization?.bookedProductTags.includes(SOCIAL_CONTENT_PRODUCT_TAG) ?? false;

  const socialPosts = booked
    ? await prisma.socialPost.findMany({
        where: { organizationId: session.user.organizationId, status: { in: ["CLIENT_REVIEW", "SCHEDULED", "PUBLISHED"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];

  const toClientPost = (post: (typeof socialPosts)[number]): ClientSocialPost => ({
    id: post.id,
    platform: post.platform,
    caption: post.caption,
    mediaUrl: post.mediaUrl,
    mediaUrls: post.mediaUrls,
    mediaType: post.mediaType,
    status: post.status as "CLIENT_REVIEW" | "SCHEDULED" | "PUBLISHED",
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    publishedUrl: post.publishedUrl,
  });
  const pendingApproval = socialPosts.filter((p) => p.status === "CLIENT_REVIEW").map(toClientPost);
  const socialTimeline = socialPosts
    .filter((p) => p.status === "SCHEDULED" || p.status === "PUBLISHED")
    .map(toClientPost)
    .sort((a, b) => {
      const aDate = a.publishedAt ?? a.scheduledAt ?? "";
      const bDate = b.publishedAt ?? b.scheduledAt ?? "";
      return bDate.localeCompare(aDate);
    });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Social Media Content</h1>
      <p className="mb-6 text-muted-foreground">
        Freigaben und veröffentlichte Beiträge für Instagram, Facebook und LinkedIn.
      </p>

      {!booked ? (
        <SocialContentPaywall organizationId={session.user.organizationId} />
      ) : pendingApproval.length === 0 && socialTimeline.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Hier erscheinen Freigaben und veröffentlichte Beiträge, sobald es mit eurem Social Media Content losgeht.
          </CardContent>
        </Card>
      ) : (
        <SocialContentSection pendingApproval={pendingApproval} timeline={socialTimeline} />
      )}
    </div>
  );
}
