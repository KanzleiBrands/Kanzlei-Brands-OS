"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, GripVerticalIcon, LockIcon, MailIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createFunnel,
  updateFunnelSettings,
  deleteFunnel,
  addFunnelStep,
  updateFunnelStep,
  deleteFunnelStep,
  reorderFunnelSteps,
  enrollContacts,
  unenrollContact,
  requestEmailMarketingUnlock,
  toggleEmailMarketingBooked,
} from "@/lib/actions/funnels";
import { EMAIL_MARKETING_PRICE_LABEL } from "@/lib/funnels/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSaveToast } from "@/hooks/use-save-toast";

const BODY_VARIABLES = [
  { token: "{{firstName}}", label: "Vorname" },
  { token: "{{lastName}}", label: "Nachname" },
  { token: "{{companyName}}", label: "Firma" },
] as const;

function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const cursor = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}

export type FunnelStepData = {
  id: string;
  order: number;
  delayDays: number;
  subject: string;
  preheader: string | null;
  bodyText: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
};

export type FunnelEnrollmentData = {
  id: string;
  contactName: string;
  status: "ACTIVE" | "COMPLETED" | "STOPPED";
  currentStepOrder: number;
};

export type FunnelData = {
  id: string;
  name: string;
  active: boolean;
  triggerType: "MANUAL" | "ON_NEW_LEAD" | "ON_INACTIVITY";
  inactivityDays: number | null;
  senderAccountId: string | null;
  steps: FunnelStepData[];
  enrollments: FunnelEnrollmentData[];
  enrollableContacts: { id: string; name: string; email: string | null }[];
};

export type SenderAccountOption = { id: string; email: string; userName: string };

const TRIGGER_LABELS: Record<FunnelData["triggerType"], string> = {
  MANUAL: "Manuell eingeschrieben",
  ON_NEW_LEAD: "Automatisch bei neuem Lead",
  ON_INACTIVITY: "Automatisch nach Inaktivität",
};

function pct(part: number, total: number) {
  if (total === 0) return "0 %";
  return `${((part / total) * 100).toFixed(1)} %`;
}

function delayLabel(step: FunnelStepData, index: number) {
  if (step.delayDays === 0) return index === 0 ? "Sofort bei Einschreibung" : "Direkt nach der vorherigen Mail";
  return index === 0 ? `${step.delayDays} Tag(e) nach Einschreibung` : `${step.delayDays} Tag(e) nach der vorherigen Mail`;
}

function SortableStepRow({
  step,
  index,
  canManage,
  onEdit,
  onDelete,
}: {
  step: FunnelStepData;
  index: number;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-lg border bg-card p-3"
    >
      {canManage && (
        <button
          type="button"
          aria-label="Verschieben"
          className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
      )}
      <MailIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{step.subject}</p>
        <p className="text-xs text-muted-foreground">{delayLabel(step, index)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {step.sentCount} gesendet · {pct(step.openCount, step.sentCount)} Öffnungsrate · {pct(step.clickCount, step.sentCount)}{" "}
          Klickrate
        </p>
      </div>
      {canManage && (
        <div className="flex shrink-0 gap-1">
          <button type="button" aria-label="Bearbeiten" onClick={onEdit} className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground">
            <PencilIcon className="size-3.5" />
          </button>
          <button type="button" aria-label="Löschen" onClick={onDelete} className="flex size-7 items-center justify-center text-muted-foreground hover:text-destructive">
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function StepForm({
  funnelId,
  step,
  onDone,
}: {
  funnelId: string;
  step?: FunnelStepData;
  onDone: () => void;
}) {
  const action = step ? updateFunnelStep : addFunnelStep;
  const [error, formAction, isPending] = useActionState(action, undefined);
  useSaveToast(error, isPending, step ? "Schritt gespeichert." : "Schritt hinzugefügt.");
  const wasPending = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) onDone();
    wasPending.current = isPending;
  }, [isPending, error, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="funnelId" value={funnelId} />
      {step && <input type="hidden" name="stepId" value={step.id} />}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Warten (Tage)</label>
        <Input name="delayDays" type="number" min={0} defaultValue={step?.delayDays ?? 0} className="w-20" />
      </div>
      <Input name="subject" placeholder="Betreff" defaultValue={step?.subject ?? ""} required />
      <Input name="preheader" placeholder="Preheader (optional)" defaultValue={step?.preheader ?? ""} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Variable einfügen:</span>
        {BODY_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, v.token)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {v.label}
          </button>
        ))}
      </div>
      <Textarea
        ref={bodyRef}
        name="bodyText"
        placeholder={"Text der E-Mail. Links: [Linktext](https://...)"}
        rows={6}
        defaultValue={step?.bodyText ?? ""}
        required
      />
      <div className="flex gap-2">
        <Input name="ctaLabel" placeholder="Button-Text (optional)" defaultValue={step?.ctaLabel ?? ""} />
        <Input name="ctaUrl" type="url" placeholder="Button-Link (optional)" defaultValue={step?.ctaUrl ?? ""} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

function StepsList({ funnelId, steps, canManage }: { funnelId: string; steps: FunnelStepData[]; canManage: boolean }) {
  const [order, setOrder] = useState(steps.map((s) => s.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reorderError, reorderAction, reorderPending] = useActionState(reorderFunnelSteps, undefined);
  useSaveToast(reorderError, reorderPending, "Reihenfolge gespeichert.");
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const orderedSteps = order.map((id) => steps.find((s) => s.id === id)).filter((s): s is FunnelStepData => !!s);
  const dirty = JSON.stringify(order) !== JSON.stringify(steps.map((s) => s.id));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((o) => {
      const oldIndex = o.indexOf(String(active.id));
      const newIndex = o.indexOf(String(over.id));
      return arrayMove(o, oldIndex, newIndex);
    });
  }

  function handleDelete(stepId: string) {
    if (!window.confirm("Diesen Schritt wirklich löschen?")) return;
    const formData = new FormData();
    formData.set("stepId", stepId);
    startTransition(() => {
      deleteFunnelStep(formData);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {orderedSteps.map((step, index) =>
              editingId === step.id ? (
                <StepForm key={step.id} funnelId={funnelId} step={step} onDone={() => setEditingId(null)} />
              ) : (
                <SortableStepRow
                  key={step.id}
                  step={step}
                  index={index}
                  canManage={canManage}
                  onEdit={() => setEditingId(step.id)}
                  onDelete={() => handleDelete(step.id)}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      {orderedSteps.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Noch keine Schritte angelegt.</p>
      )}

      {canManage && dirty && (
        <form action={reorderAction} className="flex justify-end">
          <input type="hidden" name="funnelId" value={funnelId} />
          <input type="hidden" name="stepIds" value={JSON.stringify(order)} />
          <Button type="submit" size="sm" variant="outline" disabled={reorderPending}>
            {reorderPending ? "Wird gespeichert..." : "Reihenfolge speichern"}
          </Button>
        </form>
      )}

      {canManage &&
        (adding ? (
          <StepForm funnelId={funnelId} onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
            <PlusIcon className="size-3.5" />
            Schritt hinzufügen
          </Button>
        ))}
    </div>
  );
}

function FunnelSettingsForm({ funnel, senderAccounts }: { funnel: FunnelData; senderAccounts: SenderAccountOption[] }) {
  const [error, formAction, isPending] = useActionState(updateFunnelSettings, undefined);
  useSaveToast(error, isPending, "Funnel-Einstellungen gespeichert.");
  const [triggerType, setTriggerType] = useState(funnel.triggerType);
  const [senderAccountId, setSenderAccountId] = useState(funnel.senderAccountId ?? "");
  const [, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="funnelId" value={funnel.id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input name="name" defaultValue={funnel.name} className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Trigger</label>
          <input type="hidden" name="triggerType" value={triggerType} />
          <Select value={triggerType} onValueChange={(v) => setTriggerType(v as FunnelData["triggerType"])}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue>{(v: FunnelData["triggerType"]) => TRIGGER_LABELS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANUAL">Manuell einschreiben</SelectItem>
              <SelectItem value="ON_NEW_LEAD">Automatisch bei neuem Lead</SelectItem>
              <SelectItem value="ON_INACTIVITY">Automatisch nach Inaktivität</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {triggerType === "ON_INACTIVITY" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tage ohne Aktivität</label>
            <Input name="inactivityDays" type="number" min={1} defaultValue={funnel.inactivityDays ?? 3} className="w-24" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Absender-Postfach</label>
          <input type="hidden" name="senderAccountId" value={senderAccountId} />
          <Select value={senderAccountId} onValueChange={(v) => setSenderAccountId(v ?? "")}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue>
                {(v: string) => {
                  const account = senderAccounts.find((a) => a.id === v);
                  return account ? `${account.userName} (${account.email})` : "Kein Postfach ausgewählt";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-80">
              <SelectItem value="">Kein Postfach ausgewählt</SelectItem>
              {senderAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.userName} ({a.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="mb-2 flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="active" value="true" defaultChecked={funnel.active} />
          Aktiv
        </label>
      </div>
      {senderAccounts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Noch kein Postfach für diesen Kunden verbunden - unter Einstellungen &rarr; Postfach verbinden.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={deletePending}
          onClick={() => {
            if (!window.confirm(`Funnel "${funnel.name}" wirklich löschen? Alle Schritte und Einschreibungen gehen verloren.`)) return;
            const formData = new FormData();
            formData.set("funnelId", funnel.id);
            setDeletePending(true);
            startTransition(() => {
              deleteFunnel(formData);
            });
          }}
        >
          {deletePending ? "Wird gelöscht..." : "Funnel löschen"}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

function EnrollPicker({ funnelId, contacts }: { funnelId: string; contacts: FunnelData["enrollableContacts"] }) {
  const [error, formAction, isPending] = useActionState(enrollContacts, undefined);
  useSaveToast(error, isPending, "Leads eingeschrieben.");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Alle Leads dieser Kampagne sind bereits eingeschrieben.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="funnelId" value={funnelId} />
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border bg-card p-2">
        {contacts.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              name="contactIds"
              value={c.id}
              checked={selected.has(c.id)}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })
              }
            />
            <span className="flex-1 truncate">{c.name}</span>
            {!c.email && <span className="text-xs text-destructive">keine E-Mail</span>}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={isPending || selected.size === 0}>
        {isPending ? "Wird eingeschrieben..." : `${selected.size || ""} Lead(s) einschreiben`}
      </Button>
    </form>
  );
}

const STATUS_LABELS: Record<FunnelEnrollmentData["status"], string> = {
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
  STOPPED: "Gestoppt",
};

function EnrollmentsTable({ enrollments, canManage }: { enrollments: FunnelEnrollmentData[]; canManage: boolean }) {
  const [, startTransition] = useTransition();
  if (enrollments.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Leads eingeschrieben.</p>;

  return (
    <div className="flex flex-col gap-1">
      {enrollments.map((e) => (
        <div key={e.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
          <span className="flex-1 truncate">{e.contactName}</span>
          <Badge variant={e.status === "ACTIVE" ? "default" : e.status === "COMPLETED" ? "secondary" : "outline"}>
            {STATUS_LABELS[e.status]}
          </Badge>
          <span className="text-xs whitespace-nowrap text-muted-foreground">Schritt {e.currentStepOrder}</span>
          {canManage && e.status === "ACTIVE" && (
            <button
              type="button"
              className="text-xs whitespace-nowrap text-muted-foreground underline hover:text-destructive"
              onClick={() => {
                const formData = new FormData();
                formData.set("enrollmentId", e.id);
                startTransition(() => {
                  unenrollContact(formData);
                });
              }}
            >
              Entfernen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function FunnelCard({
  funnel,
  canManage,
  senderAccounts,
  expanded,
  onToggle,
}: {
  funnel: FunnelData;
  canManage: boolean;
  senderAccounts: SenderAccountOption[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const activeEnrollments = funnel.enrollments.filter((e) => e.status === "ACTIVE").length;

  return (
    <Card>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{funnel.name}</p>
            <Badge variant={funnel.active ? "default" : "outline"}>{funnel.active ? "Aktiv" : "Inaktiv"}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {TRIGGER_LABELS[funnel.triggerType]}
            {funnel.triggerType === "ON_INACTIVITY" && funnel.inactivityDays ? ` (${funnel.inactivityDays} Tage)` : ""} ·{" "}
            {funnel.steps.length} Schritt(e) · {activeEnrollments} aktiv eingeschrieben
          </p>
        </div>
        <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <CardContent className="flex flex-col gap-4 border-t pt-4">
          {canManage ? (
            <FunnelSettingsForm
              key={`${funnel.name}|${funnel.triggerType}|${funnel.inactivityDays}|${funnel.senderAccountId}|${funnel.active}`}
              funnel={funnel}
              senderAccounts={senderAccounts}
            />
          ) : (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {TRIGGER_LABELS[funnel.triggerType]}
              {funnel.triggerType === "ON_INACTIVITY" && funnel.inactivityDays ? ` nach ${funnel.inactivityDays} Tagen` : ""}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">E-Mail-Schritte</p>
            <StepsList
              key={funnel.steps.map((s) => s.id).join(",")}
              funnelId={funnel.id}
              steps={funnel.steps}
              canManage={canManage}
            />
          </div>

          {canManage && funnel.triggerType === "MANUAL" && (
            <div>
              <p className="mb-2 text-sm font-medium">Leads einschreiben</p>
              <EnrollPicker funnelId={funnel.id} contacts={funnel.enrollableContacts} />
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Eingeschriebene Leads</p>
            <EnrollmentsTable enrollments={funnel.enrollments} canManage={canManage} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function EmailMarketingPaywall({ pipelineId }: { pipelineId: string }) {
  const [error, formAction, isPending] = useActionState(requestEmailMarketingUnlock, undefined);
  const [requested, setRequested] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setRequested(true);
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <LockIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">E-Mail Marketing freischalten</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Nurture-Funnels, die eure Leads automatisch per E-Mail über euer eigenes Postfach begleiten - inklusive
            Öffnungs- und Klickrate je Mail.
          </p>
        </div>
        {requested ? (
          <p className="text-sm text-green-600">Anfrage gesendet - wir melden uns bei dir.</p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Wird gesendet..." : `Freischalten für nur ${EMAIL_MARKETING_PRICE_LABEL}`}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function BookedToggle({ organizationId, pipelineId, booked }: { organizationId: string; pipelineId: string; booked: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        defaultChecked={booked}
        disabled={isPending}
        onChange={() => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          formData.set("pipelineId", pipelineId);
          startTransition(() => {
            toggleEmailMarketingBooked(formData);
          });
        }}
      />
      Für diesen Kunden gebucht ({EMAIL_MARKETING_PRICE_LABEL})
    </label>
  );
}

export function EmailMarketingTab({
  pipelineId,
  organizationId,
  isAgency,
  canManage,
  booked,
  funnels,
  senderAccounts,
  isOwnOrganization = false,
}: {
  pipelineId: string;
  organizationId: string;
  isAgency: boolean;
  canManage: boolean;
  booked: boolean;
  funnels: FunnelData[];
  senderAccounts: SenderAccountOption[];
  /** True fürs interne Marketing-Center: die Kampagne gehört der Agentur selbst, nicht einem Kunden. */
  isOwnOrganization?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(funnels.length === 1 ? funnels[0].id : null);
  const [creating, setCreating] = useState(false);
  const [error, formAction, isPending] = useActionState(createFunnel, undefined);
  useSaveToast(error, isPending, "Funnel angelegt.");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setCreating(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  const locked = !isAgency && !booked;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">E-Mail Marketing</h2>
          <p className="text-sm text-muted-foreground">
            Nurture-Funnels für die Leads dieser Kampagne - Versand über das verbundene Postfach{" "}
            {isOwnOrganization ? "des zuständigen Mitarbeiters" : canManage ? "des Kunden" : "eures Ansprechpartners bei Kanzlei Brands"}, Antworten
            landen direkt im echten Postfach.
          </p>
        </div>
        {canManage && !creating && !locked && (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-3.5" />
            Neuer Funnel
          </Button>
        )}
      </div>

      {isAgency && (
        <BookedToggle organizationId={organizationId} pipelineId={pipelineId} booked={booked} />
      )}

      {locked ? (
        <EmailMarketingPaywall pipelineId={pipelineId} />
      ) : (
        <>
          {canManage && creating && (
            <form action={formAction} className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
              <input type="hidden" name="pipelineId" value={pipelineId} />
              <Input name="name" placeholder="Name des Funnels (z.B. Willkommens-Funnel)" className="max-w-xs" autoFocus />
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Wird angelegt..." : "Anlegen"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setCreating(false)}>
                Abbrechen
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
          )}

          {funnels.length === 0 && !creating && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Noch kein Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {canManage
                    ? "Lege einen Funnel an, um Leads dieser Kampagne automatisch per E-Mail zu nurturen."
                    : "Kanzlei Brands hat für diese Kampagne noch keinen E-Mail-Funnel eingerichtet."}
                </p>
              </CardContent>
            </Card>
          )}

          {funnels.map((funnel) => (
            <FunnelCard
              key={funnel.id}
              funnel={funnel}
              canManage={canManage}
              senderAccounts={senderAccounts}
              expanded={openId === funnel.id}
              onToggle={() => setOpenId((id) => (id === funnel.id ? null : funnel.id))}
            />
          ))}
        </>
      )}
    </div>
  );
}
