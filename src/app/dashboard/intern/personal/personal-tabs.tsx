"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/intern/personal", label: "Startseite" },
  { href: "/dashboard/intern/personal/verzeichnis", label: "Mitarbeiter", superAdminOnly: true },
  { href: "/dashboard/intern/personal/organigramm", label: "Organigramm" },
  { href: "/dashboard/intern/personal/abwesenheit", label: "Abwesenheit" },
  { href: "/dashboard/intern/personal/unternehmen", label: "Unternehmen", superAdminOnly: true },
];

/** "Mitarbeiter" (komplettes Verzeichnis) und "Unternehmen" sind Geschäftsführungssache - für alle anderen Mitarbeiter tabu (siehe verzeichnis/page.tsx, unternehmen/page.tsx). */
export function PersonalTabs({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin);

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-foreground/10">
      {visibleTabs.map((tab) => {
        const active = tab.href === "/dashboard/intern/personal" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t-md px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground ${
              active ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
