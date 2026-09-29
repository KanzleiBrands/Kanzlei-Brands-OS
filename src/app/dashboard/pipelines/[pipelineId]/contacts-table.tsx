"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { CONTACT_SOURCE_LABELS } from "@/lib/contact-source-labels";
import { contactDisplayName } from "@/lib/contact-display";
import { formatRelativeTime } from "@/lib/relative-time";
import { StarRating } from "@/components/star-rating";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { StageSelectForm } from "@/app/dashboard/contacts/[contactId]/stage-select-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MergeDuplicatesDialog } from "@/components/contacts/merge-duplicates-dialog";
import type { DuplicateContactKeys } from "@/lib/duplicate-contacts";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName?: string | null;
  source: string;
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type Stage = {
  id: string;
  name: string;
  color: string | null;
  contacts: Contact[];
};

type SelectableStage = { id: string; name: string; color: string | null; isRejected: boolean };

type Row = Contact & { stageId: string; stageName: string; stageColor: string | null };

type SortKey = "name" | "eingang" | "bearbeitet";

// Ein Klick statt "erst nach Bearbeitet sortieren, dann Reihenfolge merken" -
// deckt genau die drei Fragen ab, die man beim schnellen Überblick über eine
// Kampagne typischerweise stellt: was ist neu reingekommen, was habe ich
// zuletzt angefasst, und - am wichtigsten für die Triage - was liegt am
// längsten unangetastet herum.
const SMART_VIEWS: { value: string; label: string; sortKey: SortKey; sortAsc: boolean }[] = [
  { value: "eingetragen", label: "Zuletzt eingetragen", sortKey: "eingang", sortAsc: false },
  { value: "bearbeitet_neu", label: "Zuletzt bearbeitet", sortKey: "bearbeitet", sortAsc: false },
  { value: "bearbeitet_alt", label: "Am längsten nicht bearbeitet", sortKey: "bearbeitet", sortAsc: true },
];

function sortRows(rows: Row[], sortKey: SortKey, sortAsc: boolean): Row[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") {
      const nameA = [a.firstName, a.lastName].filter(Boolean).join(" ");
      const nameB = [b.firstName, b.lastName].filter(Boolean).join(" ");
      cmp = nameA.localeCompare(nameB);
    } else if (sortKey === "bearbeitet") {
      cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
    } else {
      cmp = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return sortAsc ? cmp : -cmp;
  });
  return copy;
}

export function ContactsTable({
  stages,
  allStages,
  pipelineKind,
  duplicateContacts,
  canDeleteContacts,
}: {
  stages: Stage[];
  allStages: SelectableStage[];
  pipelineKind: string;
  duplicateContacts: DuplicateContactKeys;
  canDeleteContacts: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("eingang");
  const [sortAsc, setSortAsc] = useState(false);

  // Zeigt den Smart-View-Dropdown nur als "aktiv" an, wenn der aktuelle
  // Sortierzustand exakt einem der drei Presets entspricht - ein Klick auf
  // eine Spaltenüberschrift (z.B. "Kontakt") setzt ihn zurück auf "frei".
  const smartView = SMART_VIEWS.find((v) => v.sortKey === sortKey && v.sortAsc === sortAsc)?.value ?? "";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function applySmartView(value: string | null) {
    const preset = SMART_VIEWS.find((v) => v.value === value);
    if (!preset) return;
    setSortKey(preset.sortKey);
    setSortAsc(preset.sortAsc);
  }

  // Innerhalb jeder Stufe sortiert (nicht global über alle Stufen hinweg) -
  // so bleiben die Phasen als Struktur erhalten (wie bei Asana), man sieht
  // aber sofort, was innerhalb einer Stufe am längsten liegen geblieben ist.
  const groups = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        rows: sortRows(
          stage.contacts.map((contact) => ({ ...contact, stageId: stage.id, stageName: stage.name, stageColor: stage.color })),
          sortKey,
          sortAsc,
        ),
      })),
    [stages, sortKey, sortAsc],
  );

  const totalCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Select value={smartView} onValueChange={applySmartView}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Smart View">
              {(value: string) => SMART_VIEWS.find((v) => v.value === value)?.label ?? "Smart View"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SMART_VIEWS.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
              Kontakt {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Quelle</TableHead>
            <TableHead>Bewertung</TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("eingang")}>
              Eingang {sortKey === "eingang" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("bearbeitet")}>
              Bearbeitet {sortKey === "bearbeitet" ? (sortAsc ? "↑" : "↓") : ""}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {totalCount === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Noch keine Kontakte.
              </TableCell>
            </TableRow>
          )}
          {totalCount > 0 &&
            groups.map(({ stage, rows }) => (
            <Fragment key={stage.id}>
              <TableRow className="pointer-events-none bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={7} className="py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }}
                    />
                    <span className="text-sm font-semibold">{stage.name}</span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-xs text-muted-foreground">{rows.length}</span>
                  </span>
                </TableCell>
              </TableRow>
              {rows.map((contact) => {
                const fullName = contactDisplayName(contact);
                return (
                  <TableRow key={contact.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-2">
                        <span
                          className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: avatarColorFor(fullName) }}
                        >
                          {initialsOf(contact.firstName, contact.lastName)}
                        </span>
                        <span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium">{fullName}</span>
                            {((contact.email && duplicateContacts.emails.has(contact.email.trim().toLowerCase())) ||
                              (contact.phone && duplicateContacts.phones.has(contact.phone.trim().toLowerCase()))) && (
                              <span onClick={(e) => e.preventDefault()}>
                                <MergeDuplicatesDialog contactId={contact.id} contactName={fullName} label="⚠ Duplikat" />
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-muted-foreground">{contact.email ?? contact.phone ?? "-"}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StageSelectForm
                        contactId={contact.id}
                        currentStageId={contact.stageId}
                        pipelineKind={pipelineKind}
                        stages={allStages}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}
                    </TableCell>
                    <TableCell>
                      <StarRating contactId={contact.id} rating={contact.rating} size="sm" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.createdAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(contact.updatedAt)}</TableCell>
                    <TableCell>
                      {canDeleteContacts && <DeleteContactButton contactId={contact.id} contactName={fullName} />}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow key={`empty-${stage.id}`}>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Keine Kontakte in dieser Stufe.
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
