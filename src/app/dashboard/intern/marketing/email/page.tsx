import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { isAgencyMarketingStaffFor } from "@/lib/access";
import { ContactsTab } from "./contacts-tab";
import { TagsTab } from "./tags-tab";
import { FunnelsTab } from "./funnels-tab";

const TABS = [
  { key: "kontakte", label: "Kontakte" },
  { key: "tags", label: "Tags" },
  { key: "funnels", label: "Funnels" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * Eigenständiges internes E-Mail-Marketing-Tool (wie ActiveCampaign/
 * KlickTipp) - bewusst KEINE Kampagne/Pipeline wie beim Kunden-CRM, bleibt
 * immer im internen Portal. Kontakte kommen über Tag-Webhooks (externe
 * Landingpages/Ad-Formulare) oder manuell in die Liste, ein Tag löst
 * automatisch verknüpfte Funnels aus (siehe applyTag in marketing-list.ts).
 * Kein Double-Opt-in. Fallout über Calendly-Buchung + Sync zu Close.io -
 * siehe src/app/api/webhooks/calendly und src/lib/close/client.ts.
 */
export default async function InternalEmailMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { tab: tabParam } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "kontakte";
  const organizationId = session.user.organizationId;
  const canManage = session.user.role === "AGENCY_ADMIN" || (await isAgencyMarketingStaffFor(session, organizationId));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-foreground/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/intern/marketing/email?tab=${t.key}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "kontakte" && <ContactsTab organizationId={organizationId} canManage={canManage} />}
      {tab === "tags" && <TagsTab organizationId={organizationId} canManage={canManage} />}
      {tab === "funnels" && <FunnelsTab organizationId={organizationId} canManage={canManage} />}
    </div>
  );
}
