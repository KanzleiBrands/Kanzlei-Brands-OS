"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, MailIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import {
  updateMarketingFunnelSettings,
  deleteMarketingFunnel,
  addMarketingFunnelStep,
  updateMarketingFunnelStep,
  deleteMarketingFunnelStep,
  enrollSubscribers,
  unenrollSubscriber,
} from "@/lib/actions/marketing-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSaveToast } from "@/hooks/use-save-toast";
import { EmailAiAssistant } from "@/app/dashboard/pipelines/[pipelineId]/email-ai-assistant";

const NONE = "__none__";

const BODY_VARIABLES = [
  { token: "{{firstName}}", label: "Vorname" },
  { token: "{{lastName}}", label: "Nachname" },
] as const;

type StepData = {
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

type EnrollmentData = { id: string; status: "ACTIVE" | "COMPLETED" | "STOPPED"; currentStepOrder: number; subscriberName: string };

export type MarketingFunnelData = {
  id: string;
  name: string;
  active: boolean;
  triggerTagId: string | null;
  triggerTagName: string | null;
  senderAccountId: string | null;
  steps: StepData[];
  enrollments: EnrollmentData[];
  enrollableSubscribers: { id: string; name: string }[];
};

type SenderAccountOption = { id: string; email: string; userName: string };
type TagOption = { id: string; name: string };

function pct(part: number, total: number) {
  if (total === 0) return "0 %";
  return `${((part / total) * 100).toFixed(1)} %`;
}

function delayLabel(step: StepData, index: number) {
  if (step.delayDays === 0) return index === 0 ? "Sofort bei Tag-Zuweisung" : "Direkt nach der vorherigen Mail";
  return index === 0 ? `${step.delayDays} Tag(e) nach Tag-Zuweisung` : `${step.delayDays} Tag(e) nach der vorherigen Mail`;
}

function StepRow({ step, index, canManage, onEdit, onDelete }: { step: StepData; index: number; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
      <MailIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{step.subject}</p>
        <p className="text-xs text-muted-foreground">{delayLabel(step, index)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {step.sentCount} gesendet · {pct(step.openCount, step.sentCount)} Öffnungsrate · {pct(step.clickCount, step.sentCount)} Klickrate
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

function StepForm({ funnelId, step, onDone }: { funnelId: string; step?: StepData; onDone: () => void }) {
  const action = step ? updateMarketingFunnelStep : addMarketingFunnelStep;
  const [error, formAction, isPending] = useActionState(action, undefined);
  useSaveToast(error, isPending, step ? "Schritt gespeichert." : "Schritt hinzugefügt.");
  const wasPending = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [subject, setSubject] = useState(step?.subject ?? "");
  const [bodyText, setBodyText] = useState(step?.bodyText ?? "");

  useEffect(() => {
    if (wasPending.current && !isPending && !error) onDone();
    wasPending.current = isPending;
  }, [isPending, error, onDone]);

  function insertVariable(token: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? bodyText.length;
    const end = el?.selectionEnd ?? bodyText.length;
    const next = `${bodyText.slice(0, start)}${token}${bodyText.slice(end)}`;
    setBodyText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="funnelId" value={funnelId} />
      {step && <input type="hidden" name="stepId" value={step.id} />}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Warten (Tage)</label>
        <Input name="delayDays" type="number" min={0} defaultValue={step?.delayDays ?? 0} className="w-20" />
      </div>
      <Input name="subject" placeholder="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <Input name="preheader" placeholder="Preheader (optional)" defaultValue={step?.preheader ?? ""} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Variable einfügen:</span>
        {BODY_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => insertVariable(v.token)}
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
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        required
      />
      <EmailAiAssistant bodyText={bodyText} onInsertSubject={setSubject} onInsertBody={setBodyText} />
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

function StepsList({ funnelId, steps, canManage }: { funnelId: string; steps: StepData[]; canManage: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete(stepId: string) {
    if (!window.confirm("Diesen Schritt wirklich löschen?")) return;
    const formData = new FormData();
    formData.set("stepId", stepId);
    startTransition(() => {
      deleteMarketingFunnelStep(formData);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) =>
        editingId === step.id ? (
          <StepForm key={step.id} funnelId={funnelId} step={step} onDone={() => setEditingId(null)} />
        ) : (
          <StepRow key={step.id} step={step} index={index} canManage={canManage} onEdit={() => setEditingId(step.id)} onDelete={() => handleDelete(step.id)} />
        ),
      )}

      {steps.length === 0 && !adding && <p className="text-sm text-muted-foreground">Noch keine Schritte angelegt.</p>}

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

function FunnelSettingsForm({ funnel, tags, senderAccounts }: { funnel: MarketingFunnelData; tags: TagOption[]; senderAccounts: SenderAccountOption[] }) {
  const [error, formAction, isPending] = useActionState(updateMarketingFunnelSettings, undefined);
  useSaveToast(error, isPending, "Funnel-Einstellungen gespeichert.");
  const [triggerTagId, setTriggerTagId] = useState(funnel.triggerTagId ?? NONE);
  const [senderAccountId, setSenderAccountId] = useState(funnel.senderAccountId ?? NONE);
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
          <label className="text-xs text-muted-foreground">Trigger-Tag</label>
          <input type="hidden" name="triggerTagId" value={triggerTagId} />
          <Select value={triggerTagId} onValueChange={(v) => setTriggerTagId(v ?? NONE)}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue>{(v: string) => (v === NONE ? "Nur manuell" : tags.find((t) => t.id === v)?.name)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nur manuell</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Absender-Postfach</label>
          <input type="hidden" name="senderAccountId" value={senderAccountId} />
          <Select value={senderAccountId} onValueChange={(v) => setSenderAccountId(v ?? NONE)}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue>
                {(v: string) => {
                  const account = senderAccounts.find((a) => a.id === v);
                  return account ? `${account.userName} (${account.email})` : "Kein Postfach ausgewählt";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-80">
              <SelectItem value={NONE}>Kein Postfach ausgewählt</SelectItem>
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
        <p className="text-xs text-muted-foreground">Noch kein Postfach verbunden - unter Einstellungen &rarr; Postfach verbinden.</p>
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
              deleteMarketingFunnel(formData);
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

function EnrollPicker({ funnelId, subscribers }: { funnelId: string; subscribers: { id: string; name: string }[] }) {
  const [error, formAction, isPending] = useActionState(enrollSubscribers, undefined);
  useSaveToast(error, isPending, "Kontakte eingeschrieben.");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (subscribers.length === 0) {
    return <p className="text-sm text-muted-foreground">Alle aktiven Kontakte sind bereits eingeschrieben.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="funnelId" value={funnelId} />
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border bg-card p-2">
        {subscribers.map((s) => (
          <label key={s.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              name="subscriberIds"
              value={s.id}
              checked={selected.has(s.id)}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  return next;
                })
              }
            />
            <span className="flex-1 truncate">{s.name}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={isPending || selected.size === 0}>
        {isPending ? "Wird eingeschrieben..." : `${selected.size || ""} Kontakt(e) einschreiben`}
      </Button>
    </form>
  );
}

const STATUS_LABELS: Record<EnrollmentData["status"], string> = {
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
  STOPPED: "Gestoppt",
};

function EnrollmentsTable({ enrollments, canManage }: { enrollments: EnrollmentData[]; canManage: boolean }) {
  const [, startTransition] = useTransition();
  if (enrollments.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Kontakte eingeschrieben.</p>;

  return (
    <div className="flex flex-col gap-1">
      {enrollments.map((e) => (
        <div key={e.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
          <span className="flex-1 truncate">{e.subscriberName}</span>
          <Badge variant={e.status === "ACTIVE" ? "default" : e.status === "COMPLETED" ? "secondary" : "outline"}>{STATUS_LABELS[e.status]}</Badge>
          <span className="text-xs whitespace-nowrap text-muted-foreground">Schritt {e.currentStepOrder}</span>
          {canManage && e.status === "ACTIVE" && (
            <button
              type="button"
              className="text-xs whitespace-nowrap text-muted-foreground underline hover:text-destructive"
              onClick={() => {
                const formData = new FormData();
                formData.set("enrollmentId", e.id);
                startTransition(() => {
                  unenrollSubscriber(formData);
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
  tags,
  senderAccounts,
  canManage,
  expanded,
  onToggle,
}: {
  funnel: MarketingFunnelData;
  tags: TagOption[];
  senderAccounts: SenderAccountOption[];
  canManage: boolean;
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
            {funnel.triggerTagName ? `Trigger: ${funnel.triggerTagName}` : "Nur manuell"} · {funnel.steps.length} Schritt(e) ·{" "}
            {activeEnrollments} aktiv eingeschrieben
          </p>
        </div>
        <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <CardContent className="flex flex-col gap-4 border-t pt-4">
          {canManage ? (
            <FunnelSettingsForm
              key={`${funnel.name}|${funnel.triggerTagId}|${funnel.senderAccountId}|${funnel.active}`}
              funnel={funnel}
              tags={tags}
              senderAccounts={senderAccounts}
            />
          ) : (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {funnel.triggerTagName ? `Trigger: ${funnel.triggerTagName}` : "Nur manuell"}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">E-Mail-Schritte</p>
            <StepsList key={funnel.steps.map((s) => s.id).join(",")} funnelId={funnel.id} steps={funnel.steps} canManage={canManage} />
          </div>

          {canManage && (
            <div>
              <p className="mb-2 text-sm font-medium">Kontakte einschreiben</p>
              <EnrollPicker funnelId={funnel.id} subscribers={funnel.enrollableSubscribers} />
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Eingeschriebene Kontakte</p>
            <EnrollmentsTable enrollments={funnel.enrollments} canManage={canManage} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function FunnelsList({
  funnels,
  tags,
  senderAccounts,
  canManage,
}: {
  funnels: MarketingFunnelData[];
  tags: TagOption[];
  senderAccounts: SenderAccountOption[];
  canManage: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(funnels.length === 1 ? funnels[0].id : null);

  return (
    <div className="flex flex-col gap-2">
      {funnels.map((funnel) => (
        <FunnelCard
          key={funnel.id}
          funnel={funnel}
          tags={tags}
          senderAccounts={senderAccounts}
          canManage={canManage}
          expanded={openId === funnel.id}
          onToggle={() => setOpenId((id) => (id === funnel.id ? null : funnel.id))}
        />
      ))}
    </div>
  );
}
