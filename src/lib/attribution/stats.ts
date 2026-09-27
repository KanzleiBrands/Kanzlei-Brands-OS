import { prisma } from "@/lib/prisma";
import type { AdPlatform } from "@prisma/client";

export type CreativeStats = { id: string; name: string; previewUrl: string | null; leads: number; dealsWon: number; revenue: number };

export type CampaignStats = {
  id: string;
  platform: AdPlatform;
  name: string;
  touchpoints: number;
  leads: number;
  dealsWon: number;
  revenue: number;
  spend: number;
  costPerLead: number | null;
  costPerDeal: number | null;
  creatives: CreativeStats[];
};

/**
 * Kampagnen-Kennzahlen für den Kampagnen-Reiter - "welche Creatives bringen
 * Sales" wird über die Candidate-Kette aufgelöst: Touchpoint -> Candidate ->
 * JourneyEvent(DEAL_WON), da Deals selbst keinen direkten Kampagnenbezug
 * tragen (der kommt ausschließlich über die Touchpoints des jeweiligen
 * Candidates zustande).
 */
export async function getCampaignStats(organizationId: string): Promise<CampaignStats[]> {
  const campaigns = await prisma.adCampaign.findMany({
    where: { organizationId },
    include: { creatives: true, _count: { select: { touchpoints: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    campaigns.map(async (campaign) => {
      const [spendAgg, campaignCandidateIds] = await Promise.all([
        prisma.adSpendEntry.aggregate({ where: { campaignId: campaign.id }, _sum: { amountSpent: true } }),
        prisma.touchpoint.findMany({
          where: { campaignId: campaign.id, candidateId: { not: null } },
          select: { candidateId: true },
          distinct: ["candidateId"],
        }),
      ]);
      const candidateIds = campaignCandidateIds.map((t) => t.candidateId!);
      const deals =
        candidateIds.length > 0
          ? await prisma.journeyEvent.findMany({ where: { type: "DEAL_WON", candidateId: { in: candidateIds } } })
          : [];
      const spend = spendAgg._sum.amountSpent ?? 0;
      const revenue = deals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0);

      const creatives: CreativeStats[] = await Promise.all(
        campaign.creatives.map(async (creative) => {
          const creativeCandidateIds = await prisma.touchpoint.findMany({
            where: { creativeId: creative.id, candidateId: { not: null } },
            select: { candidateId: true },
            distinct: ["candidateId"],
          });
          const ids = creativeCandidateIds.map((t) => t.candidateId!);
          const creativeDeals = ids.length > 0 ? await prisma.journeyEvent.findMany({ where: { type: "DEAL_WON", candidateId: { in: ids } } }) : [];
          return {
            id: creative.id,
            name: creative.name,
            previewUrl: creative.previewUrl,
            leads: ids.length,
            dealsWon: creativeDeals.length,
            revenue: creativeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0),
          };
        }),
      );

      return {
        id: campaign.id,
        platform: campaign.platform,
        name: campaign.name,
        touchpoints: campaign._count.touchpoints,
        leads: candidateIds.length,
        dealsWon: deals.length,
        revenue,
        spend,
        costPerLead: candidateIds.length > 0 ? spend / candidateIds.length : null,
        costPerDeal: deals.length > 0 ? spend / deals.length : null,
        creatives: creatives.sort((a, b) => b.revenue - a.revenue),
      };
    }),
  );
}

export type CandidateAccountSummary = {
  id: string;
  name: string | null;
  domain: string | null;
  candidateCount: number;
  lastEventAt: Date | null;
  dealWon: boolean;
  dealValue: number | null;
};

/** Für die Candidate-Journey-Liste - ein Eintrag pro Firma (mehrere Entscheider zählen als ein Account). */
export async function listCandidateAccounts(organizationId: string): Promise<CandidateAccountSummary[]> {
  const accounts = await prisma.candidateAccount.findMany({
    where: { organizationId },
    include: { candidates: { include: { journeyEvents: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return accounts.map((account) => {
    const allEvents = account.candidates.flatMap((c) => c.journeyEvents);
    const dealWonEvent = allEvents.find((e) => e.type === "DEAL_WON");
    const lastEventAt = allEvents.reduce<Date | null>((latest, e) => (!latest || e.occurredAt > latest ? e.occurredAt : latest), null);
    return {
      id: account.id,
      name: account.name,
      domain: account.domain,
      candidateCount: account.candidates.length,
      lastEventAt,
      dealWon: !!dealWonEvent,
      dealValue: dealWonEvent?.dealValue ?? null,
    };
  });
}

export type JourneyTimelineItem =
  | { kind: "touchpoint"; occurredAt: Date; platform: AdPlatform; campaignName: string | null; creativeName: string | null; landingUrl: string }
  | { kind: "event"; occurredAt: Date; type: string; dealValue: number | null; note: string | null };

export type CandidateAccountDetail = {
  id: string;
  name: string | null;
  domain: string | null;
  candidates: { id: string; email: string; name: string | null }[];
  timeline: JourneyTimelineItem[];
};

/** Vollständige Journey (alle Touchpoints + Meilensteine über alle Personen dieser Firma hinweg), chronologisch. */
export async function getAccountJourney(accountId: string): Promise<CandidateAccountDetail | null> {
  const account = await prisma.candidateAccount.findUnique({
    where: { id: accountId },
    include: {
      candidates: {
        include: {
          touchpoints: { include: { campaign: true, creative: true }, orderBy: { occurredAt: "asc" } },
          journeyEvents: { orderBy: { occurredAt: "asc" } },
        },
      },
    },
  });
  if (!account) return null;

  const timeline: JourneyTimelineItem[] = [];
  for (const candidate of account.candidates) {
    for (const touchpoint of candidate.touchpoints) {
      timeline.push({
        kind: "touchpoint",
        occurredAt: touchpoint.occurredAt,
        platform: touchpoint.platform,
        campaignName: touchpoint.campaign?.name ?? null,
        creativeName: touchpoint.creative?.name ?? null,
        landingUrl: touchpoint.landingUrl,
      });
    }
    for (const event of candidate.journeyEvents) {
      timeline.push({ kind: "event", occurredAt: event.occurredAt, type: event.type, dealValue: event.dealValue, note: event.note });
    }
  }
  timeline.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  return {
    id: account.id,
    name: account.name,
    domain: account.domain,
    candidates: account.candidates.map((c) => ({ id: c.id, email: c.email, name: c.name })),
    timeline,
  };
}
