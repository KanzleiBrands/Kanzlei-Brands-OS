import { prisma } from "@/lib/prisma";
import type { AdPlatform } from "@prisma/client";
import { extractCompanyDomain, resolvePlatform } from "./constants";

/**
 * Ordnet einen Touchpoint automatisch einer AdCampaign (und optional einem
 * AdCreative) zu - legt beide bei Bedarf an ("automatisch erkannt", kein
 * manuelles Kampagne-Anlegen nötig). Ohne utm_campaign bleibt campaignId
 * null (z.B. reiner Organic-/Direct-Traffic ohne Kampagnenbezug).
 */
export async function resolveCampaignAndCreative(
  organizationId: string,
  params: { utmSource: string | null; utmCampaign: string | null; utmContent: string | null; clickIdType: "FBCLID" | "GCLID" | "GBRAID" | "WBRAID" | "MSCLKID" | "LI_FAT_ID" | null },
): Promise<{ platform: AdPlatform; campaignId: string | null; creativeId: string | null }> {
  const platform = resolvePlatform(params.utmSource, params.clickIdType);
  if (!params.utmCampaign) return { platform, campaignId: null, creativeId: null };

  const campaign = await prisma.adCampaign.upsert({
    where: { organizationId_platform_name: { organizationId, platform, name: params.utmCampaign } },
    create: { organizationId, platform, name: params.utmCampaign },
    update: {},
  });

  let creativeId: string | null = null;
  if (params.utmContent) {
    const creative = await prisma.adCreative.upsert({
      where: { campaignId_name: { campaignId: campaign.id, name: params.utmContent } },
      create: { campaignId: campaign.id, name: params.utmContent },
      update: {},
    });
    creativeId = creative.id;
  }

  return { platform, campaignId: campaign.id, creativeId };
}

/**
 * Löst einen Kontakt zu Account (Firma per E-Mail-Domain) + Candidate
 * (Person) auf - legt beide bei Bedarf an. Mehrere Personen derselben Domain
 * (z.B. mehrere Partner einer Kanzlei) landen bewusst auf demselben Account,
 * damit ihre Touchpoints/Journeys gemeinsam ausgewertet werden können.
 */
export async function resolveCandidate(
  organizationId: string,
  email: string,
  name?: string | null,
): Promise<{ accountId: string; candidateId: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = extractCompanyDomain(normalizedEmail);

  const account = domain
    ? await prisma.candidateAccount.upsert({
        where: { organizationId_domain: { organizationId, domain } },
        create: { organizationId, domain },
        update: {},
      })
    : await prisma.candidateAccount.create({ data: { organizationId, domain: null } });

  const candidate = await prisma.candidate.upsert({
    where: { accountId_email: { accountId: account.id, email: normalizedEmail } },
    create: { accountId: account.id, email: normalizedEmail, name: name ?? null },
    update: name ? { name } : {},
  });

  return { accountId: account.id, candidateId: candidate.id };
}
