"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "./kanban-board";
import { ContactsTable } from "./contacts-table";
import { ExcludedContactsTable } from "./excluded-contacts-table";
import { NewContactForm } from "./new-contact-form";
import { findDuplicateEmails } from "@/lib/duplicate-contacts";
import { excludedTabLabel } from "@/lib/campaign-kind-labels";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  source: string;
  rating: number | null;
  createdAt: Date;
  customFields: unknown;
  rejectionReason: string | null;
  _count: { activities: number };
};

type Stage = {
  id: string;
  name: string;
  order: number;
  color: string | null;
  isRejected: boolean;
  contacts: Contact[];
};

export function PipelineView({
  pipelineId,
  pipelineKind,
  stages,
  showDuplicateWarning,
}: {
  pipelineId: string;
  pipelineKind: string;
  stages: Stage[];
  showDuplicateWarning: boolean;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [statusTab, setStatusTab] = useState<"qualified" | "excluded">("qualified");
  const [search, setSearch] = useState("");
  const duplicateEmails = useMemo(
    () => (showDuplicateWarning ? findDuplicateEmails(stages) : new Set<string>()),
    [stages, showDuplicateWarning],
  );

  const hasRejectedStages = useMemo(() => stages.some((stage) => stage.isRejected), [stages]);
  const firstQualifiedStageId = useMemo(
    () => [...stages].filter((s) => !s.isRejected).sort((a, b) => a.order - b.order)[0]?.id,
    [stages],
  );
  const firstRejectedStageId = useMemo(
    () => [...stages].filter((s) => s.isRejected).sort((a, b) => a.order - b.order)[0]?.id,
    [stages],
  );

  const filteredStages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stages;
    return stages.map((stage) => ({
      ...stage,
      contacts: stage.contacts.filter((contact) => {
        const haystack = [contact.firstName, contact.lastName, contact.email, contact.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      }),
    }));
  }, [stages, search]);

  const qualifiedStages = useMemo(() => filteredStages.filter((s) => !s.isRejected), [filteredStages]);
  const excludedStages = useMemo(() => filteredStages.filter((s) => s.isRejected), [filteredStages]);
  const qualifiedCount = qualifiedStages.reduce((sum, s) => sum + s.contacts.length, 0);
  const excludedCount = excludedStages.reduce((sum, s) => sum + s.contacts.length, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <NewContactForm
            pipelineId={pipelineId}
            pipelineKind={pipelineKind}
            stages={stages.filter((s) => !s.isRejected)}
          />
          <Input
            placeholder={pipelineKind === "APPLICANTS" ? "Bewerber suchen..." : "Lead suchen..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="inline-flex flex-shrink-0 rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "board" ? "default" : "ghost"}
            onClick={() => setView("board")}
          >
            Board
          </Button>
          <Button type="button" size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>
            Liste
          </Button>
        </div>
      </div>

      {hasRejectedStages && (
        <div className="mb-4 inline-flex rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setStatusTab("qualified")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              statusTab === "qualified" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Qualifiziert <span className="ml-1 text-sm text-muted-foreground">{qualifiedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("excluded")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              statusTab === "excluded" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {excludedTabLabel(pipelineKind)} <span className="ml-1 text-sm text-muted-foreground">{excludedCount}</span>
          </button>
        </div>
      )}

      {statusTab === "excluded" && hasRejectedStages ? (
        <ExcludedContactsTable stages={excludedStages} reactivateStageId={firstQualifiedStageId} />
      ) : view === "board" ? (
        <KanbanBoard
          stages={qualifiedStages}
          duplicateEmails={duplicateEmails}
          rejectStageId={firstRejectedStageId}
          pipelineKind={pipelineKind}
        />
      ) : (
        <ContactsTable
          stages={qualifiedStages}
          allStages={stages}
          pipelineKind={pipelineKind}
          duplicateEmails={duplicateEmails}
        />
      )}
    </div>
  );
}
