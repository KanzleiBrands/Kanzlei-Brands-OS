"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BanIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveContactStage } from "@/lib/actions/contacts";
import { reorderStages, createStage, deleteStage } from "@/lib/actions/stages";
import { formatRelativeTime } from "@/lib/relative-time";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { contactDisplayName } from "@/lib/contact-display";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { RejectionReasonDialog } from "@/components/rejection-reason-dialog";
import { FinalStageDialog } from "@/components/final-stage-dialog";
import { MergeDuplicatesDialog } from "@/components/contacts/merge-duplicates-dialog";
import type { DuplicateContactKeys } from "@/lib/duplicate-contacts";

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
  _count: { activities: number };
};

type Stage = {
  id: string;
  name: string;
  order: number;
  color: string | null;
  isRejected: boolean;
  isFinal: boolean;
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

  return <span className={`rounded-full px-1.5 py-0.5 text-xs whitespace-nowrap ${classes}`}>{label}</span>;
}

function StageColumn({
  stage,
  stageIndex,
  canManageStages,
  duplicateContacts,
  dragOverStageId,
  isPending,
  rejectStageId,
  canDeleteContacts,
  onDragOver,
  onDragLeave,
  onDropContact,
  onReject,
  onDeleteStage,
}: {
  stage: Stage;
  stageIndex: number;
  canManageStages: boolean;
  duplicateContacts: DuplicateContactKeys;
  dragOverStageId: string | null;
  isPending: boolean;
  rejectStageId?: string;
  canDeleteContacts: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDropContact: (contactId: string) => void;
  onReject: (contactId: string) => void;
  onDeleteStage: (stageId: string, stageName: string) => void;
}) {
  const rejectLabel = "Als ungeeignet markieren";
  // useSortable ist immer aktiv (Hooks dürfen nicht bedingt aufgerufen werden) -
  // ohne canManageStages hängen einfach keine Drag-Listener am Griff, die Spalte
  // bleibt also für Kunden/Nicht-Admins optisch und funktional unverändert.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      data-testid={`stage-column-${stage.id}`}
      className={`flex w-[260px] flex-shrink-0 flex-col rounded-lg border bg-muted/30 p-2 sm:w-72 ${
        dragOverStageId === stage.id ? "ring-2 ring-primary" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        const contactId = e.dataTransfer.getData("text/contact-id");
        if (contactId) onDropContact(contactId);
      }}
    >
      <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium">
        {canManageStages && (
          <button
            type="button"
            aria-label="Stufe verschieben"
            className="-ml-1 flex size-5 shrink-0 touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        )}
        <span
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }}
        />
        <span className="min-w-0 flex-1 truncate">{stage.name}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {stage.contacts.length}
        </span>
        {canManageStages && (
          <button
            type="button"
            aria-label={`Stufe "${stage.name}" löschen`}
            title="Stufe löschen"
            className="flex size-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDeleteStage(stage.id, stage.name)}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </p>
      <div className="flex flex-col gap-2.5">
        {stage.contacts.map((contact) => {
          const fullName = contactDisplayName(contact);
          const isDuplicate =
            (!!contact.email && duplicateContacts.emails.has(contact.email.trim().toLowerCase())) ||
            (!!contact.phone && duplicateContacts.phones.has(contact.phone.trim().toLowerCase()));
          return (
            <Link
              key={contact.id}
              href={`/dashboard/contacts/${contact.id}`}
              draggable
              data-testid="contact-card"
              onDragStart={(e) => {
                e.dataTransfer.setData("text/contact-id", contact.id);
              }}
              className={`group relative block cursor-grab rounded-md border bg-background p-3.5 text-sm shadow-sm transition-shadow hover:border-primary hover:shadow-md ${
                isPending ? "opacity-60" : ""
              }`}
            >
              <div className="absolute top-1 right-1 hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                {rejectStageId && stage.id !== rejectStageId && (
                  <button
                    type="button"
                    title={rejectLabel}
                    aria-label={rejectLabel}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      onReject(contact.id);
                    }}
                  >
                    <BanIcon className="size-3.5" />
                  </button>
                )}
                {canDeleteContacts && <DeleteContactButton contactId={contact.id} contactName={fullName} />}
              </div>
              <div className="flex items-center gap-2 overflow-hidden pr-0 sm:pr-14">
                <span
                  className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColorFor(fullName) }}
                >
                  {initialsOf(contact.firstName, contact.lastName)}
                </span>
                <p className="min-w-0 flex-1 truncate font-medium">{fullName}</p>
                <span className="flex-shrink-0">
                  <TimeBadge createdAt={contact.createdAt} isFirstStage={stageIndex === 0} />
                </span>
              </div>

              {isDuplicate && (
                <span onClick={(e) => e.preventDefault()} className="mt-1.5 inline-block">
                  <MergeDuplicatesDialog contactId={contact.id} contactName={fullName} />
                </span>
              )}

              <p className="mt-2 truncate text-xs text-muted-foreground">
                Eingang {new Date(contact.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </p>

              <div className="mt-2.5 flex items-center justify-between">
                <StarRating contactId={contact.id} rating={contact.rating} size="sm" />
                {contact._count.activities > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {contact._count.activities} {contact._count.activities === 1 ? "Aktivität" : "Aktivitäten"}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function KanbanBoard({
  pipelineId,
  stages,
  duplicateContacts,
  rejectStageId,
  finalStageId,
  pipelineKind,
  canDeleteContacts,
  canManageStages,
}: {
  pipelineId: string;
  stages: Stage[];
  duplicateContacts: DuplicateContactKeys;
  rejectStageId?: string;
  finalStageId?: string;
  pipelineKind: string;
  canDeleteContacts: boolean;
  canManageStages: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [rejectingContactId, setRejectingContactId] = useState<string | null>(null);
  const [finalizingContactId, setFinalizingContactId] = useState<string | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  // Nicht per useEffect mit `stages` synchron gehalten (React rät davon ab,
  // synchron in einem Effect setState aufzurufen) - stattdessen bekommt
  // KanbanBoard von PipelineView einen key aus den Stage-Ids, der bei einer
  // tatsächlichen Änderung (z.B. neue Stufe durch CSV-Import) einen
  // Re-Mount und damit einen frischen Ausgangszustand erzwingt.
  const [stageOrder, setStageOrder] = useState(() => stages.map((s) => s.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function move(stageId: string, contactId: string, extra?: { rejectionReason?: string; startDate?: string; dealVolumeEur?: string }) {
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("stageId", stageId);
    if (extra?.rejectionReason) formData.set("rejectionReason", extra.rejectionReason);
    if (extra?.startDate) formData.set("startDate", extra.startDate);
    if (extra?.dealVolumeEur) formData.set("dealVolumeEur", extra.dealVolumeEur);
    startTransition(() => {
      moveContactStage(formData);
    });
  }

  function handleDrop(stageId: string, contactId: string) {
    const currentStage = stages.find((s) => s.contacts.some((c) => c.id === contactId));
    if (stageId === finalStageId && currentStage?.id !== finalStageId) {
      setFinalizingContactId(contactId);
    } else {
      move(stageId, contactId);
    }
    setDragOverStageId(null);
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectStageId || !rejectingContactId) return;
    move(rejectStageId, rejectingContactId, { rejectionReason: reason });
    setRejectingContactId(null);
  }

  function handleFinalConfirm(fields: { startDate?: string; dealVolumeEur?: string }) {
    if (!finalStageId || !finalizingContactId) return;
    move(finalStageId, finalizingContactId, fields);
    setFinalizingContactId(null);
  }

  function handleStageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stageOrder.indexOf(String(active.id));
    const newIndex = stageOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(stageOrder, oldIndex, newIndex);
    setStageOrder(next);
    const formData = new FormData();
    formData.set("pipelineId", pipelineId);
    formData.set("stageIds", JSON.stringify(next));
    startTransition(() => {
      reorderStages(undefined, formData);
    });
  }

  function handleDeleteStage(stageId: string, stageName: string) {
    if (!window.confirm(`Stufe "${stageName}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    const formData = new FormData();
    formData.set("stageId", stageId);
    startTransition(async () => {
      const error = await deleteStage(formData);
      if (error) toast.error(error);
    });
  }

  function handleCreateStage() {
    const name = newStageName.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set("pipelineId", pipelineId);
    formData.set("name", name);
    startTransition(async () => {
      const error = await createStage(undefined, formData);
      if (error) {
        toast.error(error);
      } else {
        setNewStageName("");
        setIsAddingStage(false);
      }
    });
  }

  const orderedStages = stageOrder.map((id) => stages.find((s) => s.id === id)).filter((s): s is Stage => !!s);

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStageDragEnd}>
        <SortableContext items={stageOrder} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {orderedStages.map((stage, stageIndex) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                stageIndex={stageIndex}
                canManageStages={canManageStages}
                duplicateContacts={duplicateContacts}
                dragOverStageId={dragOverStageId}
                isPending={isPending}
                rejectStageId={rejectStageId}
                canDeleteContacts={canDeleteContacts}
                onDragOver={() => setDragOverStageId(stage.id)}
                onDragLeave={() => setDragOverStageId(null)}
                onDropContact={(contactId) => handleDrop(stage.id, contactId)}
                onReject={(contactId) => setRejectingContactId(contactId)}
                onDeleteStage={handleDeleteStage}
              />
            ))}
            {canManageStages &&
              (isAddingStage ? (
                <div className="flex w-[260px] flex-shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 sm:w-72">
                  <Input
                    autoFocus
                    placeholder="Name der Stufe"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateStage();
                      if (e.key === "Escape") {
                        setIsAddingStage(false);
                        setNewStageName("");
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={isPending} onClick={handleCreateStage}>
                      Hinzufügen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingStage(false);
                        setNewStageName("");
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex h-10 w-[260px] flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground sm:w-72"
                  onClick={() => setIsAddingStage(true)}
                >
                  <PlusIcon className="size-4" />
                  Stufe hinzufügen
                </button>
              ))}
          </div>
        </SortableContext>
      </DndContext>
      <RejectionReasonDialog
        open={!!rejectingContactId}
        onOpenChange={(open) => {
          if (!open) setRejectingContactId(null);
        }}
        pipelineKind={pipelineKind}
        onConfirm={handleRejectConfirm}
        isPending={isPending}
      />
      <FinalStageDialog
        open={!!finalizingContactId}
        onOpenChange={(open) => {
          if (!open) setFinalizingContactId(null);
        }}
        pipelineKind={pipelineKind}
        onConfirm={handleFinalConfirm}
        isPending={isPending}
      />
    </div>
  );
}
