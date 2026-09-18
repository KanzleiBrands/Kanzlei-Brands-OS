"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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

export function PipelineView({ pipelineId, stages }: { pipelineId: string; stages: Stage[] }) {
  const [view, setView] = useState<"board" | "list">("board");
  const duplicateEmails = useMemo(() => findDuplicateEmails(stages), [stages]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <NewContactForm pipelineId={pipelineId} stages={stages} />
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
        <KanbanBoard stages={stages} duplicateEmails={duplicateEmails} />
      ) : (
        <ContactsTable stages={stages} duplicateEmails={duplicateEmails} />
      )}
    </div>
  );
}
