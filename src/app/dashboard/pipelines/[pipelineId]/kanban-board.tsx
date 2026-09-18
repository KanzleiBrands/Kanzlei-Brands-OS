"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveContactStage } from "@/lib/actions/contacts";
import { NewContactForm } from "./new-contact-form";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: string;
};

type Stage = {
  id: string;
  name: string;
  order: number;
  contacts: Contact[];
};

export function KanbanBoard({ pipelineId, stages }: { pipelineId: string; stages: Stage[] }) {
  const [isPending, startTransition] = useTransition();
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  function handleDrop(stageId: string, contactId: string) {
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("stageId", stageId);
    startTransition(() => {
      moveContactStage(formData);
    });
    setDragOverStageId(null);
  }

  return (
    <div>
      <div className="mb-4">
        <NewContactForm pipelineId={pipelineId} stages={stages} />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            data-testid={`stage-column-${stage.id}`}
            className={`flex w-64 flex-shrink-0 flex-col rounded-lg border bg-muted/30 p-2 ${
              dragOverStageId === stage.id ? "ring-2 ring-primary" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStageId(stage.id);
            }}
            onDragLeave={() => setDragOverStageId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const contactId = e.dataTransfer.getData("text/contact-id");
              if (contactId) handleDrop(stage.id, contactId);
            }}
          >
            <p className="mb-2 px-1 text-sm font-medium">
              {stage.name} <span className="text-muted-foreground">({stage.contacts.length})</span>
            </p>
            <div className="flex flex-col gap-2">
              {stage.contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                  draggable
                  data-testid="contact-card"
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/contact-id", contact.id);
                  }}
                  className={`block cursor-grab rounded-md border bg-background p-2 text-sm shadow-sm hover:border-primary ${
                    isPending ? "opacity-60" : ""
                  }`}
                >
                  <p className="font-medium">
                    {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt"}
                  </p>
                  {contact.email && <p className="truncate text-xs text-muted-foreground">{contact.email}</p>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
