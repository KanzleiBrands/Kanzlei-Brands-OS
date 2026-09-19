"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon } from "lucide-react";

export function SettingsLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/settings");

  return (
    <Link
      href="/dashboard/settings"
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <SettingsIcon className="size-4" />
      Einstellungen
    </Link>
  );
}
