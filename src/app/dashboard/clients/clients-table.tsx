"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { avatarColorFor, initialsOf } from "@/lib/avatar";

type ClientRow = {
  id: string;
  name: string;
  totalContacts: number;
  activePipelines: number;
  totalPipelines: number;
  unprocessed: number;
  staleUnprocessed: number;
  newLast7Days: number;
  lastLeadAt: string | null;
  leadsUsed: number;
  applicantsUsed: number;
  leadsQuota: number | null;
  applicantsQuota: number | null;
};

function quotaLine(label: string, used: number, quota: number | null) {
  if (used === 0 && quota === null) return null;
  const overQuota = quota !== null && used > quota;
  return (
    <p key={label} className={overQuota ? "font-medium text-destructive" : undefined}>
      {label}: {used}
      {quota !== null && ` / ${quota}`}
    </p>
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

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function avatarFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return initialsOf(parts[0] ?? null, parts[1] ?? null);
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastLead");

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
          className="max-w-xs"
        />
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="w-56">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kunde</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead>Kampagnen</TableHead>
            <TableHead>Kontingente</TableHead>
            <TableHead>Letzter Lead</TableHead>
            <TableHead>Unbearbeitet</TableHead>
            <TableHead>Überfällig</TableHead>
            <TableHead>Neu (7 Tage)</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <span
                    className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: avatarColorFor(client.name) }}
                  >
                    {avatarFor(client.name)}
                  </span>
                  {client.name}
                </Link>
              </TableCell>
              <TableCell>{client.totalContacts}</TableCell>
              <TableCell>
                {client.activePipelines} / {client.totalPipelines}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {(() => {
                  const lines = [
                    quotaLine("Mandatsakquise", client.leadsUsed, client.leadsQuota),
                    quotaLine("Recruiting", client.applicantsUsed, client.applicantsQuota),
                  ].filter(Boolean);
                  return lines.length > 0 ? lines : "–";
                })()}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(client.lastLeadAt)}</TableCell>
              <TableCell>{client.unprocessed}</TableCell>
              <TableCell>
                {client.staleUnprocessed > 0 ? (
                  <Badge variant="destructive">{client.staleUnprocessed}</Badge>
                ) : (
                  client.staleUnprocessed
                )}
              </TableCell>
              <TableCell>
                {client.newLast7Days > 0 ? <Badge>{client.newLast7Days}</Badge> : client.newLast7Days}
              </TableCell>
              <TableCell>
                <Link href={`/dashboard/clients/${client.id}`} className="text-sm underline">
                  Portal öffnen →
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && clients.length > 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Kein Kunde passt zur Suche.
              </TableCell>
            </TableRow>
          )}
          {clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Noch keine Kunden angelegt.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
