import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { isAgencyMarketingStaffFor } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { getCampaignStats, listCandidateAccounts } from "@/lib/attribution/stats";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackingSnippetCard } from "./tracking-snippet-card";
import { SyncButton } from "./sync-button";
import { CampaignTable } from "./campaign-table";
import { AdSpendForm } from "./ad-spend-form";
import { AccountList } from "./account-list";
import { AdsStatusCard } from "./ads-status-card";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Inhouse-Attributionstool (Moneyboard-Ersatz) für die EIGENEN Akquise-
 * Kampagnen von Kanzlei Brands - bewusst kein CRM (Leads/Deals bleiben in
 * Close.io), nur Performance-Reporting: welche Kampagne/welches Creative
 * bringt welche Leads/Deals zu welchen Kosten. Kampagnen entstehen
 * automatisch aus utm_campaign (Tracking-Snippet) bzw. aus dem Close.io-Sync,
 * kein manuelles Anlegen nötig.
 */
export default async function CampaignsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;
  const canManage = session.user.role === "AGENCY_ADMIN" || (await isAgencyMarketingStaffFor(session, organizationId));
  if (!canManage) redirect("/dashboard/intern");

  const [campaigns, accounts, baseUrl] = await Promise.all([
    getCampaignStats(organizationId),
    listCandidateAccounts(organizationId),
    getBaseUrl(),
  ]);

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalDeals = campaigns.reduce((sum, c) => sum + c.dealsWon, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);

  const campaignOptions = await prisma.adCampaign.findMany({
    where: { organizationId },
    select: { id: true, name: true, platform: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Kampagnen</h2>
        <p className="text-sm text-muted-foreground">
          Performance-Reporting für eure eigenen Akquise-Kampagnen (A-Mandanten, Mitarbeitergewinnung) - Leads/Deals
          bleiben in Close.io, hier sieht man nur, welche Kampagne/welches Creative was zu welchen Kosten bringt.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Leads gesamt</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalLeads}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Deals gewonnen</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalDeals}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Umsatz</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Werbeausgaben</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(totalSpend)}</p></CardContent>
        </Card>
      </div>

      <TrackingSnippetCard baseUrl={baseUrl} organizationId={organizationId} />

      <AdsStatusCard />

      <Card>
        <CardHeader>
          <CardTitle>Kampagnen-Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Läuft automatisch (Close.io alle 15 Minuten, Werbekosten nachts) - der Button unten ist nur für einen
            sofortigen manuellen Refresh, kein Pflichtklick.
          </p>
          <SyncButton />
        </CardHeader>
        <CardContent>
          <CampaignTable campaigns={campaigns} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Werbekosten manuell nachtragen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nur als Fallback für Plattformen ohne API-Zugang (siehe oben) oder für Ausgaben außerhalb von Meta/Google/
            LinkedIn - sobald eine Plattform verbunden ist, läuft ihr Spend automatisch, keine Eingabe mehr nötig.
          </p>
        </CardHeader>
        <CardContent>
          <AdSpendForm campaigns={campaignOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Candidate Journeys</CardTitle></CardHeader>
        <CardContent>
          <AccountList accounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
