"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BackLink } from "@/components/back-link";

type Pipeline = { id: string; name: string; active: boolean };
type ClientOrg = { id: string; name: string; pipelines: Pipeline[] };
type NavLink = { href: string; label: string };

export function SidebarNav({
  role,
  links,
  clients,
}: {
  role: string;
  links: NavLink[];
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
        <Link href={`/dashboard/clients/${clientOrg.id}`} className="mb-4 flex items-center gap-2 px-2">
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {clientOrg.name[0]?.toUpperCase()}
          </span>
          <span className="overflow-hidden">
            <span className="block truncate text-sm font-semibold">{clientOrg.name}</span>
            <span className="block text-xs text-muted-foreground">Kunde</span>
          </span>
        </Link>

        <div className="mb-4 px-2">
          <BackLink href="/dashboard/clients">Zurück zur Kunden-Übersicht</BackLink>
        </div>

        <p className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground">KAMPAGNEN</p>
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
            <p className="px-3 text-xs text-muted-foreground">Keine Kampagnen vorhanden</p>
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
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              isActive("/dashboard") ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Übersicht
          </Link>
        )}
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(link.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
