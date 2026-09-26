import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { PersonalTabs } from "./personal-tabs";

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Personal</h1>
      <p className="mb-6 text-muted-foreground">Mitarbeiterverzeichnis, Organigramm, Abwesenheiten und Unternehmensdaten.</p>

      <PersonalTabs />

      {children}
    </div>
  );
}
