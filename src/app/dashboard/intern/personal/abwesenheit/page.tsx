import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { getManagedUserIds } from "@/lib/hr-access";
import { MeineAbwesenheiten } from "./meine-abwesenheiten";
import { AntraegeListe } from "./antraege-liste";
import { KontenTabelle } from "./konten-tabelle";
import { AbsenceTypesAdmin } from "./absence-types-admin";

const SUB_TABS = [
  { key: "meine", label: "Meine Abwesenheiten" },
  { key: "antraege", label: "Anträge" },
  { key: "konten", label: "Konten" },
  { key: "arten", label: "Abwesenheitsarten" },
] as const;

export default async function AbwesenheitPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isHrAdmin = session.user.role === "AGENCY_ADMIN";
  const managedUserIds = isHrAdmin ? [] : await getManagedUserIds(session.user.id, session.user.organizationId);
  const isManager = managedUserIds.length > 0;
  const canReviewRequests = isHrAdmin || isManager;

  const { tab: tabParam } = await searchParams;
  const tab = SUB_TABS.some((t) => t.key === tabParam) ? tabParam! : "meine";
  const visibleTabs = SUB_TABS.filter((t) => (t.key === "antraege" ? canReviewRequests : t.key === "konten" || t.key === "arten" ? isHrAdmin : true));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-foreground/10">
        {visibleTabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/intern/personal/abwesenheit?tab=${t.key}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "meine" && <MeineAbwesenheiten session={session} />}
      {tab === "antraege" && canReviewRequests && (
        <AntraegeListe session={session} isHrAdmin={isHrAdmin} managedUserIds={managedUserIds} />
      )}
      {tab === "konten" && isHrAdmin && <KontenTabelle organizationId={session.user.organizationId} />}
      {tab === "arten" && isHrAdmin && <AbsenceTypesAdmin />}
    </div>
  );
}
