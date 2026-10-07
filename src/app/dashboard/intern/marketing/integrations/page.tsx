import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { isAgencyMarketingStaffFor } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/prisma";
import { checkEnvStatus } from "@/lib/env-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { TrackingSnippetCard } from "../campaigns/tracking-snippet-card";
import { LeadSourceCard } from "./lead-source-card";
import { CalendlySetupButton } from "./calendly-setup-button";
import { SocialChannelList } from "../../../clients/[orgId]/social-channel-list";

function StatusRow({ label, connected, missing, hint }: { label: string; connected: boolean; missing: string[]; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-sm">
        {connected ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : <CircleIcon className="size-4 text-muted-foreground" />}
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{connected ? "verbunden" : `nicht konfiguriert${missing.length ? ` (${missing.join(", ")})` : ""}`}</span>
      </div>
      {hint && <p className="ml-6 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Zentraler Überblick über alle externen Anbindungen des internen
 * Marketing-Centers - Werbeplattformen (Kampagnen-Reiter), CRM/Termine
 * (Candidate Journey), Formular-Quellen (E-Mail-Marketing-Liste) und die
 * eigenen Social-Media-Kanäle. Fasst Status zusammen, der bisher über
 * .env.example/Settings/Kampagnen-Reiter verstreut war - kein Rätselraten
 * mehr, was schon läuft und was noch fehlt.
 */
export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;
  const canManage = session.user.role === "AGENCY_ADMIN" || (await isAgencyMarketingStaffFor(session, organizationId));
  if (!canManage) redirect("/dashboard/intern");

  const baseUrl = await getBaseUrl();

  const close = checkEnvStatus("Close.io", ["CLOSE_API_KEY"]);
  const calendlyToken = checkEnvStatus("Calendly-API-Token", ["CALENDLY_API_TOKEN"]);
  const calendly = checkEnvStatus("Calendly-Webhook", ["CALENDLY_WEBHOOK_SIGNING_KEY"]);
  const meta = checkEnvStatus("Meta Ads", ["META_ADS_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]);
  const google = checkEnvStatus("Google Ads", ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]);
  const linkedin = checkEnvStatus("LinkedIn Ads", ["LINKEDIN_ADS_ACCESS_TOKEN", "LINKEDIN_AD_ACCOUNT_ID"]);

  const [leadSourceTags, socialChannels] = await Promise.all([
    prisma.marketingTag.findMany({
      where: { organizationId, name: { in: ["Perspective", "Onepage"] } },
      include: { listWebhooks: true },
    }),
    prisma.socialChannel.findMany({ where: { organizationId }, orderBy: { platform: "asc" } }),
  ]);

  const webhookUrlFor = (label: string) => {
    const tag = leadSourceTags.find((t) => t.name === label);
    const token = tag?.listWebhooks[0]?.token;
    return token ? `${baseUrl}/api/webhooks/marketing/${token}` : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Integrationen</h2>
        <p className="text-sm text-muted-foreground">
          Alle externen Anbindungen des Marketing-Centers an einem Ort - Werbeplattformen, CRM/Termine,
          Formular-Quellen und Tracking.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Werbeplattformen (Kampagnen-Reiter)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StatusRow {...google} hint="GOOGLE_ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/CUSTOMER_ID - Setup-Schritte in .env.example." />
          <StatusRow {...meta} hint="META_ADS_ACCESS_TOKEN/AD_ACCOUNT_ID (System-User mit ads_read) - getrennt von den Content-Publishing-Zugängen unten." />
          <StatusRow {...linkedin} hint="LINKEDIN_ADS_ACCESS_TOKEN/AD_ACCOUNT_ID (Ads-Reporting-Scope) - getrennt vom organischen Posten unten." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>CRM & Termine (Candidate Journey)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StatusRow {...close} hint="Speist Leads, Termine (Quali-/Sales-Call) und Deal-Abschlüsse in die Candidate Journey ein - läuft alle 15 Min. automatisch." />
          <StatusRow {...calendlyToken} hint="Personal Access Token (Scope webhooks:read/write) - wird nur einmalig gebraucht, um das Webhook-Abo unten automatisch anzulegen." />
          <StatusRow
            {...calendly}
            hint={`Webhook-Signatur zur Verifizierung eingehender Events auf ${baseUrl}/api/webhooks/calendly - entsteht automatisch beim Einrichten unten (Button), nicht manuell im Calendly-UI anzulegen.`}
          />
          <CalendlySetupButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formular-/Landingpage-Quellen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kontakte aus diesen Tools laufen direkt in die interne E-Mail-Marketing-Liste ein - Webhook-URL bei
            Perspective bzw. Onepage als ausgehenden Webhook eintragen.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LeadSourceCard
            organizationId={organizationId}
            label="Perspective"
            description="Perspective-Funnels/Formulare -> E-Mail-Marketing-Kontakte."
            webhookUrl={webhookUrlFor("Perspective")}
          />
          <LeadSourceCard
            organizationId={organizationId}
            label="Onepage"
            description="Onepage-Landingpage-Formulare -> E-Mail-Marketing-Kontakte."
            webhookUrl={webhookUrlFor("Onepage")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Media Content</CardTitle>
          <p className="text-sm text-muted-foreground">Eure eigenen Kanäle fürs organische Posten - verbinden/trennen direkt hier.</p>
        </CardHeader>
        <CardContent>
          <SocialChannelList organizationId={organizationId} channels={socialChannels} canManage={session.user.role === "AGENCY_ADMIN"} />
        </CardContent>
      </Card>

      <TrackingSnippetCard baseUrl={baseUrl} organizationId={organizationId} />

      <Card>
        <CardHeader><CardTitle>Direkt einbauen oder über Google Tag Manager?</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Empfehlung: direkt im Seiten-Code einbauen</strong>, wo immer möglich
            (Theme-Footer, globaler Header-Code, Funnelcockpit/Elementor/Thrive-Custom-Code) - lädt garantiert vor
            allem anderen und ist robuster gegen Ad-Blocker als ein GTM-Container: viele Blocklisten (auch uBlock
            Origin) blockieren googletagmanager.com direkt, ein first-party gehostetes Skript wie dieses hier nicht.
          </p>
          <p>
            Google Tag Manager ist nur dann sinnvoll, wenn eine Landingpage-Plattform wirklich <em>keinen</em> direkten
            Custom-Code-Zugang bietet und GTM der einzige Weg ist, überhaupt ein Skript einzubauen. Dann als
            &quot;Custom HTML&quot;-Tag mit Trigger &quot;Initialization - All Pages&quot; (nicht das normale
            Page-View-Trigger, das feuert später) anlegen, damit es so früh wie möglich lädt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
