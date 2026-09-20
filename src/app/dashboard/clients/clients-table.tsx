"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { avatarColorFor, initialsOf } from "@/lib/avatar";

type ClientRow = {
  id: string;
  name: string;
  totalContacts: number;
  unprocessed: number;
  staleUnprocessed: number;
  newLast7Days: number;
  applicantsTotalContacts: number;
  leadsTotalContacts: number;
  lastApplicantAt: string | null;
  lastLeadAt: string | null;
  leadsUsed: number;
  applicantsUsed: number;
  leadsQuota: number | null;
  applicantsQuota: number | null;
};

function QuotaPill({ label, used, quota }: { label: string; used: number; quota: number | null }) {
  const effectiveQuota = quota ?? 0;
  const overQuota = used > effectiveQuota;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
        overQuota ? "border-destructive/50 text-destructive" : "text-muted-foreground"
      }`}
    >
      {label} <span className={`font-medium ${overQuota ? "text-destructive" : "text-foreground"}`}>{used}/{effectiveQuota}</span>
    </span>
  );
}

function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "leadCount", label: "Lead Anzahl" },
  { value: "lastLead", label: "Letzter Lead" },
  { value: "unprocessed", label: "Unbearbeitete Leads" },
  { value: "stale", label: "Überfällige Leads" },
  { value: "newLeads", label: "Neue Leads (7 Tage)" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function avatarFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return initialsOf(parts[0] ?? null, parts[1] ?? null);
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [clients, search],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "leadCount":
          return b.totalContacts - a.totalContacts;
        case "lastLead":
          return (b.lastLeadAt ?? "").localeCompare(a.lastLeadAt ?? "");
        case "unprocessed":
          return b.unprocessed - a.unprocessed;
        case "stale":
          return b.staleUnprocessed - a.staleUnprocessed;
        case "newLeads":
          return b.newLast7Days - a.newLast7Days;
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Kunden durchsuchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue>{(value: string) => SORT_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((client) => (
          <Link
            key={client.id}
            href={`/dashboard/clients/${client.id}`}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary sm:grid sm:grid-cols-[minmax(0,220px)_1fr_auto] sm:items-center sm:gap-8"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: avatarColorFor(client.name) }}
              >
                {avatarFor(client.name)}
              </span>
              <p className="min-w-0 truncate font-medium" title={client.name}>
                {client.name}
              </p>
            </div>

            <div className="flex flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <QuotaPill label="Stellenanzeigen" used={client.applicantsUsed} quota={client.applicantsQuota} />
                <InfoPill>{client.applicantsTotalContacts} Bewerber gesamt</InfoPill>
                <InfoPill>Letzter Bewerber: {formatDate(client.lastApplicantAt, "keiner bisher")}</InfoPill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <QuotaPill label="Mandatsakquise" used={client.leadsUsed} quota={client.leadsQuota} />
                <InfoPill>{client.leadsTotalContacts} Leads gesamt</InfoPill>
                <InfoPill>Letzter Lead: {formatDate(client.lastLeadAt, "keiner bisher")}</InfoPill>
              </div>
              {(client.unprocessed > 0 || client.staleUnprocessed > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {client.unprocessed > 0 && <Badge variant="secondary">{client.unprocessed} unbearbeitet</Badge>}
                  {client.staleUnprocessed > 0 && <Badge variant="destructive">{client.staleUnprocessed} überfällig</Badge>}
                </div>
              )}
            </div>

            <span className="flex-shrink-0 text-sm font-medium text-primary sm:ml-2">Einloggen →</span>
          </Link>
        ))}
        {sorted.length === 0 && clients.length > 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Kein Kunde passt zur Suche.</p>
        )}
        {clients.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Kunden angelegt.</p>
        )}
      </div>
    </div>
  );
}
