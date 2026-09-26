"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/intern/marketing/social", label: "Social Media" },
  { href: "/dashboard/intern/marketing/email", label: "E-Mail-Marketing" },
  { href: "/dashboard/intern/marketing/whatsapp", label: "WhatsApp" },
];

export function MarketingTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-foreground/10">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
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
