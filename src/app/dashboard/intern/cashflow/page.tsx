import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCashflowCockpitAccess } from "@/lib/cashflow-access";
import { AnnualTab } from "./annual-tab";
import { MonthlyTab } from "./monthly-tab";
import { CashInTab } from "./cash-in-tab";
import { CashOutTab } from "./cash-out-tab";

const TABS = [
  { key: "jahr", label: "Jahresübersicht" },
  { key: "monat", label: "Monatsübersicht" },
  { key: "cashin", label: "Cash-In" },
  { key: "cashout", label: "Cash-Out" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * Cashflow Cockpit - exakter Nachbau der geteilten Google-Sheet-Vorlage,
 * bewusst OHNE Close.io: Cash-In basiert auf tatsächlich gestellten/
 * geplanten Rechnungen (live aus EasyBill, siehe src/lib/easybill/client.ts),
 * Cash-Out auf dem tatsächlichen Bankabgang. Zugriff siehe
 * src/lib/cashflow-access.ts - bewusst NICHT an die Rolle AGENCY_ADMIN
 * gekoppelt, da die auch an Fulfillment-Mitarbeitende vergeben wird.
 */
export default async function CashflowCockpitPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departments: true, hasCashflowAccess: true } });
  if (!hasCashflowCockpitAccess({ email: session.user.email, departments: user?.departments ?? [], hasCashflowAccess: user?.hasCashflowAccess ?? false })) {
    redirect("/dashboard/intern");
  }

  const { tab: tabParam, year: yearParam, month: monthParam } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "jahr";
  const year = Number(yearParam) || new Date().getFullYear();
  const rawMonth = Number(monthParam);
  const monthFilter = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : undefined;
  const month = monthFilter ?? new Date().getMonth() + 1;
  const organizationId = session.user.organizationId;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Cashflow Cockpit</h1>
        <p className="text-muted-foreground">Nur für die Geschäftsführung</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-foreground/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/intern/cashflow?tab=${t.key}&year=${year}${t.key === "monat" ? `&month=${month}` : ""}`}
            className={`flex-shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "jahr" && <AnnualTab organizationId={organizationId} year={year} />}
      {tab === "monat" && <MonthlyTab organizationId={organizationId} year={year} month={month} />}
      {tab === "cashin" && <CashInTab organizationId={organizationId} year={year} month={monthFilter} />}
      {tab === "cashout" && <CashOutTab organizationId={organizationId} year={year} month={monthFilter} />}
    </div>
  );
}
