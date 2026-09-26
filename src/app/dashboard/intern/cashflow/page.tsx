import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
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
 * Cash-Out auf dem tatsächlichen Bankabgang. Nur für die Geschäftsführung
 * (department=EXECUTIVE) bzw. AGENCY_ADMIN sichtbar - ein zusätzlicher
 * gezielter Zugriff (z.B. Backoffice) ist als User.hasCashflowAccess
 * vorbereitet, sobald die zugehörige Migration angewendet ist.
 */
export default async function CashflowCockpitPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true, hasCashflowAccess: true } });
  if (session.user.role !== "AGENCY_ADMIN" && user?.department !== "EXECUTIVE" && !user?.hasCashflowAccess) {
    redirect("/dashboard/intern");
  }

  const { tab: tabParam, year: yearParam, month: monthParam } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "jahr";
  const year = Number(yearParam) || new Date().getFullYear();
  const month = Math.min(12, Math.max(1, Number(monthParam) || new Date().getMonth() + 1));
  const organizationId = session.user.organizationId;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Cashflow Cockpit</h1>
        <p className="text-muted-foreground">Nur für die Geschäftsführung</p>
      </div>

      <div className="flex gap-1 border-b border-foreground/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/intern/cashflow?tab=${t.key}&year=${year}${t.key === "monat" ? `&month=${month}` : ""}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "jahr" && <AnnualTab organizationId={organizationId} year={year} />}
      {tab === "monat" && <MonthlyTab organizationId={organizationId} year={year} month={month} />}
      {tab === "cashin" && <CashInTab organizationId={organizationId} year={year} />}
      {tab === "cashout" && <CashOutTab organizationId={organizationId} year={year} />}
    </div>
  );
}
