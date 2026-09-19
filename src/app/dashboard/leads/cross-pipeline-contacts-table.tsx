"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { CONTACT_SOURCE_LABELS } from "@/lib/contact-source-labels";
import { StarRating } from "@/components/star-rating";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  source: string;
  rating: number | null;
  createdAt: string;
  pipelineId: string;
  pipelineName: string;
  stageName: string;
  stageColor: string | null;
};

type SortKey = "name" | "eingang" | "kampagne";

export function CrossPipelineContactsTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("eingang");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [row.firstName, row.lastName, row.email, row.phone].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        const nameA = [a.firstName, a.lastName].filter(Boolean).join(" ");
        const nameB = [b.firstName, b.lastName].filter(Boolean).join(" ");
        cmp = nameA.localeCompare(nameB);
      } else if (sortKey === "kampagne") {
        cmp = a.pipelineName.localeCompare(b.pipelineName);
      } else {
        cmp = a.createdAt.localeCompare(b.createdAt);
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
              Kontakt {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("kampagne")}>
              Kampagne {sortKey === "kampagne" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Quelle</TableHead>
            <TableHead>Bewertung</TableHead>
            <TableHead>Ort</TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("eingang")}>
              Eingang {sortKey === "eingang" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((contact) => {
            const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt";
            return (
              <TableRow key={contact.id}>
                <TableCell>
                  <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-2">
                    <span
                      className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: avatarColorFor(fullName) }}
                    >
                      {initialsOf(contact.firstName, contact.lastName)}
                    </span>
                    <span>
                      <span className="block font-medium">{fullName}</span>
                      <span className="block text-xs text-muted-foreground">{contact.email}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  <Link href={`/dashboard/pipelines/${contact.pipelineId}`} className="hover:underline">
                    {contact.pipelineName}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: contact.stageColor ?? "var(--muted-foreground)" }}
                    />
                    {contact.stageName}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}
                </TableCell>
                <TableCell>
                  <StarRating contactId={contact.id} rating={contact.rating} size="sm" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{contact.location ?? "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(contact.createdAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <DeleteContactButton contactId={contact.id} contactName={fullName} />
                </TableCell>
              </TableRow>
            );
          })}
          {sorted.length === 0 && rows.length > 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Kein Kontakt passt zur Suche.
              </TableCell>
            </TableRow>
          )}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Noch keine Kontakte.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
