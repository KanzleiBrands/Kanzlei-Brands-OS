import { prisma } from "@/lib/prisma";
import type { JourneyEventType } from "@prisma/client";
import { listCloseLeadsForAttribution, listCloseOpportunities, type CloseLead } from "@/lib/close/client";
import { resolveCampaignAndCreative, resolveCandidate } from "@/lib/attribution/resolve";

/**
 * Best-effort Rückwirkend-Sync aus Close.io in unsere eigene Candidate-
 * Journey - liest generisch ALLE custom_fields eines Leads (kein festes
 * Feld-ID-Mapping, da unterschiedliche Lead-Quellen historisch
 * unterschiedliche Felder befüllt haben, siehe Kommentar unten) statt fest
 * verdrahteter Feld-IDs. Für neue Leads (ab Tracking-Snippet-Rollout) ist
 * unsere eigene Touchpoint-Erfassung die primäre, präzise Quelle - dieser
 * Sync ist der Rückfall für alles, was schon vor dem Snippet in Close
 * entstanden ist bzw. zusätzliche CRM-Fakten (Termine, Deal Won) liefert,
 * die nur in Close existieren.
 *
 * WICHTIG (gegen einen echten Lead geprüft, mcp__Close__fetch_lead): nicht
 * jeder Lead nutzt dieselben Feldnamen - viele tragen nur "Source" +
 * "Letzter Opt-In" (Funnel-/Kampagnenname als Freitext) statt der
 * dedizierten "Quelle"/"Medium"/"Kampagne"-Felder. Wir probieren beide
 * Varianten der Reihe nach durch.
 */

const STAGE_FIELDS: { field: string; type: JourneyEventType }[] = [
  { field: "Q vereinbart", type: "QUALI_CALL_BOOKED" },
  { field: "Qualifizierungsgespräch", type: "QUALI_CALL_DONE" },
  { field: "Q nicht erschienen", type: "QUALI_CALL_NO_SHOW" },
  { field: "V1 vereinbart", type: "SALES_CALL_1_BOOKED" },
  { field: "1. Verkaufsgespräch", type: "SALES_CALL_1_DONE" },
  { field: "V1 nicht erschienen", type: "SALES_CALL_1_NO_SHOW" },
  { field: "V2 vereinbart", type: "SALES_CALL_2_BOOKED" },
  { field: "2. Verkaufsgespräch", type: "SALES_CALL_2_DONE" },
  { field: "V2 nicht erschienen", type: "SALES_CALL_2_NO_SHOW" },
  { field: "Upsell", type: "UPSELL" },
];

function fieldValue(lead: CloseLead, name: string): string | null {
  return lead.custom_fields.find((f) => f.name === name)?.value ?? null;
}

function primaryEmail(lead: CloseLead): string | null {
  for (const contact of lead.contacts ?? []) {
    const email = contact.emails?.[0]?.email;
    if (email) return email;
  }
  return null;
}

export type CloseSyncResult =
  | { ok: true; leadsProcessed: number; leadsSkippedNoEmail: number; dealsProcessed: number }
  | { ok: false; error: string };

export async function syncCloseAttribution(organizationId: string): Promise<CloseSyncResult> {
  const [leadsResult, opportunitiesResult] = await Promise.all([listCloseLeadsForAttribution(), listCloseOpportunities()]);
  if (!leadsResult.ok) return { ok: false, error: leadsResult.error };
  if (!opportunitiesResult.ok) return { ok: false, error: opportunitiesResult.error };

  const opportunitiesByLead = new Map<string, (typeof opportunitiesResult.rows)[number][]>();
  for (const opp of opportunitiesResult.rows) {
    const list = opportunitiesByLead.get(opp.lead_id) ?? [];
    list.push(opp);
    opportunitiesByLead.set(opp.lead_id, list);
  }

  let leadsProcessed = 0;
  let leadsSkippedNoEmail = 0;
  let dealsProcessed = 0;

  for (const lead of leadsResult.rows) {
    const email = primaryEmail(lead);
    if (!email) {
      leadsSkippedNoEmail += 1;
      continue;
    }

    const contactName = lead.contacts?.[0]?.name ?? null;
    const { accountId, candidateId } = await resolveCandidate(organizationId, email, contactName);
    await prisma.candidateAccount.update({ where: { id: accountId }, data: { name: lead.name, closeLeadId: lead.id } });
    await prisma.candidate.update({ where: { id: candidateId }, data: { closeContactId: lead.contacts?.[0]?.id ?? null } });

    // Kampagnen-Zuordnung best-effort: erst dedizierte Felder, sonst
    // Freitext-Fallback (Funnelname als "Kampagne", Quelle-String für Plattform-Rate).
    const kampagne = fieldValue(lead, "Kampagne") ?? fieldValue(lead, "Letzter Opt-In");
    const quelle = fieldValue(lead, "Quelle") ?? fieldValue(lead, "Source");
    const medium = fieldValue(lead, "Medium");
    let campaignId: string | null = null;
    if (kampagne) {
      const resolved = await resolveCampaignAndCreative(organizationId, {
        utmSource: medium ?? quelle,
        utmCampaign: kampagne,
        utmContent: null,
        clickIdType: null,
      });
      campaignId = resolved.campaignId;
    }

    await prisma.journeyEvent.upsert({
      where: { candidateId_type: { candidateId, type: "LEAD_CREATED" } },
      create: { candidateId, type: "LEAD_CREATED", occurredAt: new Date(lead.created_at) },
      update: {},
    });

    if (campaignId) {
      await prisma.touchpoint.updateMany({ where: { candidateId, campaignId: null }, data: { campaignId } });
    }

    for (const { field, type } of STAGE_FIELDS) {
      const raw = fieldValue(lead, field);
      if (!raw) continue;
      const occurredAt = new Date(raw);
      if (Number.isNaN(occurredAt.getTime())) continue;
      await prisma.journeyEvent.upsert({
        where: { candidateId_type: { candidateId, type } },
        create: { candidateId, type, occurredAt },
        update: { occurredAt },
      });
    }

    for (const opp of opportunitiesByLead.get(lead.id) ?? []) {
      if (opp.status_type === "won") {
        await prisma.journeyEvent.upsert({
          where: { candidateId_type: { candidateId, type: "DEAL_WON" } },
          create: {
            candidateId,
            type: "DEAL_WON",
            occurredAt: opp.date_won ? new Date(opp.date_won) : new Date(opp.updated_at),
            dealValue: opp.value != null ? opp.value / 100 : null,
          },
          update: { dealValue: opp.value != null ? opp.value / 100 : null },
        });
        dealsProcessed += 1;
      } else if (opp.status_type === "lost") {
        await prisma.journeyEvent.upsert({
          where: { candidateId_type: { candidateId, type: "DEAL_LOST" } },
          create: { candidateId, type: "DEAL_LOST", occurredAt: new Date(opp.updated_at) },
          update: {},
        });
      }
    }

    leadsProcessed += 1;
  }

  return { ok: true, leadsProcessed, leadsSkippedNoEmail, dealsProcessed };
}
