"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "./kanban-board";
import { ContactsTable } from "./contacts-table";
import { NewContactForm } from "./new-contact-form";
import { findDuplicateEmails } from "@/lib/duplicate-contacts";

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
  _count: { activities: number };
};

type Stage = {
  id: string;
  name: string;
  order: number;
  color: string | null;
  contacts: Contact[];
};

export function PipelineView({
  pipelineId,
  stages,
  showDuplicateWarning,
}: {
  pipelineId: string;
  stages: Stage[];
  showDuplicateWarning: boolean;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const duplicateEmails = useMemo(
    () => (showDuplicateWarning ? findDuplicateEmails(stages) : new Set<string>()),
    [stages, showDuplicateWarning],
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <NewContactForm pipelineId={pipelineId} stages={stages} />
          <Input
            placeholder="Lead/Bewerber suchen..."
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

      {view === "board" ? (
        <KanbanBoard stages={filteredStages} duplicateEmails={duplicateEmails} />
      ) : (
        <ContactsTable stages={filteredStages} duplicateEmails={duplicateEmails} />
      )}
    </div>
  );
}
