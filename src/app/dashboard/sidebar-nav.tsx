"use client";

import Link from "next/link";
import { ChevronRightIcon, LayoutDashboard } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { BackLink } from "@/components/back-link";

type Pipeline = { id: string; name: string; active: boolean };
type ClientOrg = { id: string; name: string; pipelines: Pipeline[] };
type NavLink = { href: string; label: string; icon?: React.ReactNode };

export function SidebarNav({
  role,
  links,
  adminLinks = [],
  clients,
}: {
  role: string;
  links: NavLink[];
  adminLinks?: NavLink[];
  clients: ClientOrg[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActive(href: string) {
    const [hrefPath, hrefQuery] = href.split("?");
    if (hrefPath === "/dashboard") return pathname === "/dashboard";
    if (!pathname.startsWith(hrefPath)) return false;
    if (!hrefQuery) return true;
    const hrefParams = new URLSearchParams(hrefQuery);
    return Array.from(hrefParams.entries()).every(([key, value]) => searchParams.get(key) === value);
  }

  const clientOrg =
    role === "AGENCY_ADMIN"
      ? (() => {
          const clientMatch = pathname.match(/^\/dashboard\/clients\/([^/]+)/);
          if (clientMatch) return clients.find((c) => c.id === clientMatch[1]) ?? null;

          const pipelineMatch = pathname.match(/^\/dashboard\/pipelines\/([^/]+)/);
          if (pipelineMatch) {
            return clients.find((c) => c.pipelines.some((p) => p.id === pipelineMatch[1])) ?? null;
          }
          return null;
        })()
      : null;

  if (clientOrg) {
    return (
      <nav className="flex flex-1 flex-col">
        <Link
          href={`/dashboard/clients/${clientOrg.id}`}
          title="Zur Übersicht dieses Kunden"
          className="mb-4 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
        >
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {clientOrg.name[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-sm font-semibold">{clientOrg.name}</span>
            <span className="block text-sm text-muted-foreground">zum Kunden</span>
          </span>
          <ChevronRightIcon className="size-4 flex-shrink-0 text-muted-foreground" />
        </Link>

        <div className="mb-4 px-2">
          <BackLink href="/dashboard/clients">
            Zurück zur
            <br />
            Kundenübersicht
          </BackLink>
        </div>

        <p className="mb-1 px-2 text-sm font-medium tracking-wide text-muted-foreground">KAMPAGNEN</p>
        <div className="flex flex-col gap-0.5">
          {clientOrg.pipelines.map((pipeline) => (
            <Link
              key={pipeline.id}
              href={`/dashboard/pipelines/${pipeline.id}`}
              className={`flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted ${
                pathname.startsWith(`/dashboard/pipelines/${pipeline.id}`) ? "bg-muted font-medium" : ""
              }`}
            >
              <span
                className={`size-1.5 flex-shrink-0 rounded-full ${pipeline.active ? "bg-emerald-500" : "bg-muted-foreground"}`}
              />
              <span className="truncate">{pipeline.name}</span>
            </Link>
          ))}
          {clientOrg.pipelines.length === 0 && (
            <p className="px-3 text-sm text-muted-foreground">Keine Kampagnen vorhanden</p>
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col">
      <div className="flex flex-col gap-1">
        {role !== "AGENCY_ADMIN" && (
          <Link
            href="/dashboard"
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive("/dashboard") ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-4 flex-shrink-0" />
            Übersicht
          </Link>
        )}
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(link.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>

      {adminLinks.length > 0 && (
        <div className="mt-5 flex flex-col gap-1">
          <p className="mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Verwaltung</p>
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(link.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
