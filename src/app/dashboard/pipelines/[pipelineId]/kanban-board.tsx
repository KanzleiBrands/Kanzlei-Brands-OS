"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BanIcon } from "lucide-react";
import { moveContactStage } from "@/lib/actions/contacts";
import { formatCustomFields } from "@/lib/format-custom-fields";
import { formatRelativeTime } from "@/lib/relative-time";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { contactDisplayName } from "@/lib/contact-display";
import { StarRating } from "@/components/star-rating";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { RejectionReasonDialog } from "@/components/rejection-reason-dialog";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  companyName?: string | null;
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

function TimeBadge({ createdAt, isFirstStage }: { createdAt: Date; isFirstStage: boolean }) {
  const [now] = useState(() => Date.now());
  const date = new Date(createdAt);
  const isToday = date.toDateString() === new Date(now).toDateString();
  const daysOpen = Math.floor((now - date.getTime()) / 86_400_000);
  const overdue = isFirstStage && daysOpen >= 2;

  const label = overdue
    ? `${daysOpen} Tage offen`
    : isToday
      ? "heute"
      : formatRelativeTime(date);

  const classes = overdue
    ? "bg-destructive/10 text-destructive"
    : isToday
      ? "bg-green-500/10 text-green-500"
      : "bg-muted text-muted-foreground";

  return <span className={`rounded-full px-1.5 py-0.5 text-[11px] whitespace-nowrap ${classes}`}>{label}</span>;
}

export function KanbanBoard({
  stages,
  duplicateEmails,
  rejectStageId,
  pipelineKind,
}: {
  stages: Stage[];
  duplicateEmails: Set<string>;
  rejectStageId?: string;
  pipelineKind: string;
}) {
  const rejectLabel = "Als ungeeignet markieren";
  const [isPending, startTransition] = useTransition();
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [rejectingContactId, setRejectingContactId] = useState<string | null>(null);

  function handleDrop(stageId: string, contactId: string) {
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("stageId", stageId);
    startTransition(() => {
      moveContactStage(formData);
    });
    setDragOverStageId(null);
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectStageId || !rejectingContactId) return;
    const formData = new FormData();
    formData.set("contactId", rejectingContactId);
    formData.set("stageId", rejectStageId);
    formData.set("rejectionReason", reason);
    startTransition(() => {
      moveContactStage(formData);
    });
    setRejectingContactId(null);
  }

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, stageIndex) => (
          <div
            key={stage.id}
            data-testid={`stage-column-${stage.id}`}
            className={`flex w-72 flex-shrink-0 flex-col rounded-lg border bg-muted/30 p-2 ${
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
            <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }}
              />
              {stage.name}
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {stage.contacts.length}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              {stage.contacts.map((contact) => {
                const fullName = contactDisplayName(contact);
                const highlight = formatCustomFields(contact.customFields)[0];
                const isDuplicate = !!contact.email && duplicateEmails.has(contact.email.trim().toLowerCase());
                return (
                  <Link
                    key={contact.id}
                    href={`/dashboard/contacts/${contact.id}`}
                    draggable
                    data-testid="contact-card"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/contact-id", contact.id);
                    }}
                    className={`group relative block cursor-grab rounded-md border bg-background p-3 text-sm shadow-sm transition-shadow hover:border-primary hover:shadow-md ${
                      isPending ? "opacity-60" : ""
                    }`}
                  >
                    <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {rejectStageId && stage.id !== rejectStageId && (
                        <button
                          type="button"
                          title={rejectLabel}
                          aria-label={rejectLabel}
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            setRejectingContactId(contact.id);
                          }}
                        >
                          <BanIcon className="size-3.5" />
                        </button>
                      )}
                      <DeleteContactButton contactId={contact.id} contactName={fullName} />
                    </div>
                    <div className="flex items-center gap-2 overflow-hidden pr-14">
                      <span
                        className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: avatarColorFor(fullName) }}
                      >
                        {initialsOf(contact.firstName, contact.lastName)}
                      </span>
                      <p className="truncate font-medium">{fullName}</p>
                    </div>

                    {isDuplicate && (
                      <span className="mt-1 inline-block rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                        ⚠ Mögliches Duplikat
                      </span>
                    )}

                    <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span>
                        Eingang{" "}
                        {new Date(contact.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </span>
                      {contact.phone && <span>{contact.phone}</span>}
                      {highlight && (
                        <span className="truncate">
                          {highlight.label}: {highlight.value}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <StarRating contactId={contact.id} rating={contact.rating} size="sm" />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {contact._count.activities > 0
                          ? `${contact._count.activities} ${contact._count.activities === 1 ? "Aktivität" : "Aktivitäten"}`
                          : ""}
                      </span>
                      <TimeBadge createdAt={contact.createdAt} isFirstStage={stageIndex === 0} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <RejectionReasonDialog
        open={!!rejectingContactId}
        onOpenChange={(open) => {
          if (!open) setRejectingContactId(null);
        }}
        pipelineKind={pipelineKind}
        onConfirm={handleRejectConfirm}
        isPending={isPending}
      />
    </div>
  );
}
