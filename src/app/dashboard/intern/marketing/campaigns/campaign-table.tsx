"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/attribution/constants";
import type { CampaignStats } from "@/lib/attribution/stats";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function CampaignTable({ campaigns }: { campaigns: CampaignStats[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (campaigns.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
        Noch keine Kampagne erkannt. Kampagnen entstehen automatisch, sobald das Tracking-Snippet auf einer
        Landingpage Besucher mit utm_campaign erfasst, oder über &quot;Close.io synchronisieren&quot;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-2 text-left font-medium text-muted-foreground" />
            <th className="p-2 text-left font-medium text-muted-foreground">Plattform</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Kampagne</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Leads</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Deals</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Umsatz</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Ausgaben</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Cost/Lead</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Cost/Deal</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <Fragment key={c.id}>
              <tr className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => toggle(c.id)}>
                <td className="p-2">
                  {c.creatives.length > 0 &&
                    (expanded.has(c.id) ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />)}
                </td>
                <td className="p-2">{PLATFORM_LABELS[c.platform]}</td>
                <td className="p-2">{c.name}</td>
                <td className="p-2 text-right tabular-nums">{c.leads}</td>
                <td className="p-2 text-right tabular-nums">{c.dealsWon}</td>
                <td className="p-2 text-right tabular-nums">{eur.format(c.revenue)}</td>
                <td className="p-2 text-right tabular-nums">{eur.format(c.spend)}</td>
                <td className="p-2 text-right tabular-nums">{c.costPerLead != null ? eur.format(c.costPerLead) : "–"}</td>
                <td className="p-2 text-right tabular-nums">{c.costPerDeal != null ? eur.format(c.costPerDeal) : "–"}</td>
              </tr>
              {expanded.has(c.id) && c.creatives.length > 0 && (
                <tr className="border-b bg-muted/20 last:border-0">
                  <td />
                  <td colSpan={8} className="p-2">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="p-1 text-left font-medium">Creative</th>
                          <th className="p-1 text-right font-medium">Leads</th>
                          <th className="p-1 text-right font-medium">Deals</th>
                          <th className="p-1 text-right font-medium">Umsatz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.creatives.map((creative) => (
                          <tr key={creative.id} className="border-t border-foreground/10">
                            <td className="p-1">{creative.name}</td>
                            <td className="p-1 text-right tabular-nums">{creative.leads}</td>
                            <td className="p-1 text-right tabular-nums">{creative.dealsWon}</td>
                            <td className="p-1 text-right tabular-nums">{eur.format(creative.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
