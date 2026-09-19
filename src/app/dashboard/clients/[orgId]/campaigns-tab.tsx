"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SettingsIcon, PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewPipelineForm } from "./new-pipeline-form";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";

type Campaign = {
  id: string;
  name: string;
  kind: string;
  location: string | null;
  totalContacts: number;
  unprocessed: number;
  staleUnprocessed: number;
  lastLeadAt: string | null;
  lastChangeAt: string | null;
};

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "leadCount", label: "Lead Anzahl" },
  { value: "lastChange", label: "Letzte Änderung" },
  { value: "lastLead", label: "Letzter Lead" },
  { value: "unprocessed", label: "Unbearbeitete Leads" },
  { value: "stale", label: "Überfällige Leads" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function QuotaBadge({ label, used, quota }: { label: string; used: number; quota: number | null }) {
  const overQuota = quota !== null && used > quota;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
        overQuota ? "border-destructive/50 text-destructive" : "text-muted-foreground"
      }`}
    >
      {label}: <span className="font-medium text-foreground">{used}</span>
      {quota !== null && <> von {quota} in Gebrauch</>}
    </span>
  );
}

export function CampaignsTab({
  organizationId,
  campaigns,
  templates,
  leadsQuota,
  applicantsQuota,
  leadsUsed,
  applicantsUsed,
}: {
  organizationId: string;
  campaigns: Campaign[];
  templates: { id: string; name: string }[];
  leadsQuota: number | null;
  applicantsQuota: number | null;
  leadsUsed: number;
  applicantsUsed: number;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastLead");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => campaigns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "leadCount":
          return b.totalContacts - a.totalContacts;
        case "lastChange":
          return (b.lastChangeAt ?? "").localeCompare(a.lastChangeAt ?? "");
        case "lastLead":
          return (b.lastLeadAt ?? "").localeCompare(a.lastLeadAt ?? "");
        case "unprocessed":
          return b.unprocessed - a.unprocessed;
        case "stale":
          return b.staleUnprocessed - a.staleUnprocessed;
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Kampagnenübersicht</h2>
        <div className="flex flex-wrap gap-2">
          <QuotaBadge label="Mandatsakquise" used={leadsUsed} quota={leadsQuota} />
          <QuotaBadge label="Recruiting" used={applicantsUsed} quota={applicantsQuota} />
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Hier siehst du alle Kampagnen dieses Kunden.</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="w-52">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((campaign) => (
          <div key={campaign.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/dashboard/pipelines/${campaign.id}`} className="truncate font-medium hover:underline">
                  {campaign.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {CAMPAIGN_KIND_LABELS[campaign.kind] ?? campaign.kind}
                  {campaign.location && ` · ${campaign.location}`}
                </p>
              </div>
              <Link
                href={`/dashboard/pipelines/${campaign.id}?tab=settings`}
                aria-label="Kampagnen-Einstellungen"
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              >
                <SettingsIcon className="size-4" />
              </Link>
            </div>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Leads gesamt</dt>
                <dd>{campaign.totalContacts}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Letzter Lead</dt>
                <dd>{formatDate(campaign.lastLeadAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Letzte Änderung</dt>
                <dd>{formatDate(campaign.lastChangeAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Unbearbeitete Leads</dt>
                <dd>{campaign.unprocessed}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Überfällige Leads</dt>
                <dd className={campaign.staleUnprocessed > 0 ? "font-medium text-destructive" : undefined}>
                  {campaign.staleUnprocessed}
                </dd>
              </div>
            </dl>
          </div>
        ))}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
              />
            }
          >
            <PlusIcon className="size-6" />
            Kampagne anlegen
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Kampagne anlegen</DialogTitle>
            </DialogHeader>
            <NewPipelineForm
              organizationId={organizationId}
              templates={templates}
              onSuccess={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {sorted.length === 0 && campaigns.length > 0 && (
          <p className="text-sm text-muted-foreground">Keine Kampagne passt zur Suche.</p>
        )}
      </div>
    </div>
  );
}
