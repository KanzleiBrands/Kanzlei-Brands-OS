"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/intern/personal", label: "Startseite" },
  { href: "/dashboard/intern/personal/verzeichnis", label: "Mitarbeiter" },
  { href: "/dashboard/intern/personal/organigramm", label: "Organigramm" },
  { href: "/dashboard/intern/personal/abwesenheit", label: "Abwesenheit" },
  { href: "/dashboard/intern/personal/unternehmen", label: "Unternehmen" },
];

export function PersonalTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-foreground/10">
      {TABS.map((tab) => {
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
