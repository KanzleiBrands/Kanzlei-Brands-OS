import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { MarketingTabs } from "./marketing-tabs";

export default async function MarketingCenterLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  if (session.user.role === "AGENCY_STAFF") {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
    if (me?.department !== "MARKETING") redirect("/dashboard/intern");
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Marketing-Center</h1>
      <p className="mb-6 text-muted-foreground">
        Unsere eigenen Social-Media-Beiträge, E-Mail-Marketing und WhatsApp - für Kanzlei Brands selbst, genau wie im Kundenportal.
      </p>

      <MarketingTabs />

      {children}
    </div>
  );
}
