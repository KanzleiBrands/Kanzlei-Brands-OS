"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LockIcon, MessageCircleIcon, TriangleAlertIcon } from "lucide-react";
import {
  requestWhatsAppUnlock,
  toggleWhatsAppBooked,
  sendWhatsAppCampaignBroadcast,
} from "@/lib/actions/whatsapp-marketing";
import { disconnectWhatsAppChannel } from "@/lib/actions/whatsapp-channels";
import { WHATSAPP_ADDON_PRICE_LABEL } from "@/lib/whatsapp-marketing/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSaveToast } from "@/hooks/use-save-toast";

export type WhatsAppTemplateOption = { name: string; language: string; category: string };
export type WhatsAppChannelOption = {
  id: string;
  displayName: string;
  displayPhoneNumber: string;
  active: boolean;
  templates: WhatsAppTemplateOption[];
};
export type WhatsAppContactOption = { id: string; name: string; phone: string | null };
export type WhatsAppSendRecord = {
  id: string;
  templateName: string;
  recipientPhone: string;
  status: "SENT" | "FAILED";
  error: string | null;
  createdAt: string;
  sentByName: string | null;
};

function BookedToggle({ organizationId, pipelineId, booked, label }: { organizationId: string; pipelineId: string; booked: boolean; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2.5 text-sm">
      <Switch
        defaultChecked={booked}
        disabled={isPending}
        onCheckedChange={() => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          formData.set("pipelineId", pipelineId);
          startTransition(() => {
            toggleWhatsAppBooked(formData);
          });
        }}
      />
      Dieser Kunde hat {label} gebucht
    </label>
  );
}

function WhatsAppPaywall({ pipelineId, label }: { pipelineId: string; label: string }) {
  const [error, formAction, isPending] = useActionState(requestWhatsAppUnlock, undefined);
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
          <h3 className="text-lg font-semibold">{label} freischalten</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Genehmigte WhatsApp-Vorlagen gezielt an die Kontakte dieser Kampagne verschicken - direkt dort, wo eure
            Zielgruppe ohnehin täglich ist.
          </p>
        </div>
        {requested ? (
          <p className="text-sm text-green-600">Anfrage gesendet - wir melden uns bei dir.</p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Wird gesendet..." : `Freischalten für nur ${WHATSAPP_ADDON_PRICE_LABEL}`}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function ChannelConnect({
  organizationId,
  pipelineId,
  channels,
  canManage,
}: {
  organizationId: string;
  pipelineId: string;
  channels: WhatsAppChannelOption[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const connectHref = `/api/meta/whatsapp/connect?organizationId=${organizationId}&pipelineId=${pipelineId}`;

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <a href={connectHref} className="self-start">
          <Button type="button" size="sm" variant="outline">
            WhatsApp-Nummer verbinden
          </Button>
        </a>
      )}
      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canManage ? "Noch keine WhatsApp-Nummer verbunden." : "Noch keine WhatsApp-Nummer verbunden - Kanzlei Brands richtet das für euch ein."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm">
              <MessageCircleIcon className="size-4 text-emerald-600" />
              <span>
                {channel.displayName} ({channel.displayPhoneNumber})
              </span>
              {!channel.active && (
                <span title="Verbindung abgelaufen - bitte erneut verbinden">
                  <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
                </span>
              )}
              {canManage && (
                <button
                  type="button"
                  aria-label="Kanal trennen"
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  onClick={() => {
                    if (!window.confirm("WhatsApp-Kanal wirklich trennen?")) return;
                    startTransition(() => {
                      disconnectWhatsAppChannel(channel.id);
                    });
                  }}
                >
                  Trennen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactPicker({ contacts, selected, onChange }: { contacts: WhatsAppContactOption[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const withPhone = contacts.filter((c) => c.phone);
  const allSelected = withPhone.length > 0 && selected.size === withPhone.length;

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(withPhone.map((c) => c.id)));
  }

  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Kontakte in dieser Kampagne.</p>;
  }

  return (
    <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border bg-card p-2">
      <label className="flex items-center gap-2 rounded-md border-b px-1.5 py-1 pb-1.5 text-sm font-medium hover:bg-muted/50">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
        Alle mit Telefonnummer auswählen ({withPhone.length})
      </label>
      {contacts.map((c) => (
        <label
          key={c.id}
          className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50 ${!c.phone ? "opacity-50" : ""}`}
        >
          <input
            type="checkbox"
            name="contactIds"
            value={c.id}
            disabled={!c.phone}
            checked={selected.has(c.id)}
            onChange={(e) =>
              onChange(
                (() => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })(),
              )
            }
          />
          <span className="flex-1 truncate">{c.name}</span>
          {!c.phone && <span className="text-xs text-destructive">keine Telefonnummer</span>}
        </label>
      ))}
    </div>
  );
}

function BroadcastForm({ pipelineId, channels, contacts }: { pipelineId: string; channels: WhatsAppChannelOption[]; contacts: WhatsAppContactOption[] }) {
  const [state, formAction, isPending] = useActionState(sendWhatsAppCampaignBroadcast, undefined);
  useSaveToast(state, isPending);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId);
  const [templateKey, setTemplateKey] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Kanal</label>
          <Select
            name="channelId"
            value={channelId}
            onValueChange={(v) => {
              if (v) {
                setChannelId(v);
                setTemplateKey("");
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => channels.find((c) => c.id === v)?.displayName ?? "Kanal wählen"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName} ({c.displayPhoneNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Vorlage</label>
          <Select name="templateKey" value={templateKey} onValueChange={(v) => v && setTemplateKey(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => {
                  const [name, language] = v.split("|");
                  return v ? `${name} (${language})` : "Vorlage wählen";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(channel?.templates ?? []).map((t) => (
                <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} ({t.language})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {channel && channel.templates.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine genehmigte Vorlage für diesen Kanal.</p>
          )}
          <input type="hidden" name="templateName" value={templateKey.split("|")[0] ?? ""} />
          <input type="hidden" name="languageCode" value={templateKey.split("|")[1] ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Empfänger</label>
        <ContactPicker contacts={contacts} selected={selected} onChange={setSelected} />
      </div>

      {state?.status === "success" && <p className="text-sm text-emerald-600">{state.message}</p>}
      {state?.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={isPending || !channelId || !templateKey || selected.size === 0} className="w-fit">
        {isPending ? "Wird verschickt..." : `${selected.size || ""} Nachricht(en) verschicken`}
      </Button>
    </form>
  );
}

export function WhatsAppMarketingTab({
  pipelineId,
  organizationId,
  label,
  isAgency,
  canManage,
  booked,
  channels,
  contacts,
  recentSends,
  isOwnOrganization = false,
}: {
  pipelineId: string;
  organizationId: string;
  /** "WhatsApp Marketing" (Mandatsakquise) oder "WhatsApp Recruiting" (Bewerbungen), je nach Kampagnen-Art. */
  label: string;
  isAgency: boolean;
  canManage: boolean;
  booked: boolean;
  channels: WhatsAppChannelOption[];
  contacts: WhatsAppContactOption[];
  recentSends: WhatsAppSendRecord[];
  /** True fürs interne Marketing-Center: die Kampagne gehört der Agentur selbst, nicht einem Kunden. */
  isOwnOrganization?: boolean;
}) {
  const locked = !isAgency && !booked;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground">
          Vorab bei Meta genehmigte Vorlagen an die Kontakte dieser Kampagne verschicken - außerhalb des 24h-Service-
          fensters lässt WhatsApp nur genehmigte Vorlagen statt Freitext zu.
        </p>
      </div>

      {isAgency && <BookedToggle organizationId={organizationId} pipelineId={pipelineId} booked={booked} label={label} />}

      {locked ? (
        <WhatsAppPaywall pipelineId={pipelineId} label={label} />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="text-sm font-medium">WhatsApp-Nummer{isOwnOrganization ? "" : " des Kunden"}</p>
              <ChannelConnect organizationId={organizationId} pipelineId={pipelineId} channels={channels} canManage={canManage} />
            </CardContent>
          </Card>

          {channels.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="mb-3 text-sm font-medium">Vorlage verschicken</p>
                <BroadcastForm pipelineId={pipelineId} channels={channels} contacts={contacts} />
              </CardContent>
            </Card>
          )}

          {channels.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <p className="mb-1 text-sm font-medium">Versandhistorie</p>
                {recentSends.length === 0 && <p className="text-sm text-muted-foreground">Noch nichts verschickt.</p>}
                {recentSends.map((send) => (
                  <div key={send.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {send.templateName} → {send.recipientPhone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(send.createdAt).toLocaleString("de-DE")} · {send.sentByName ?? "—"}
                        {send.error ? ` · ${send.error}` : ""}
                      </p>
                    </div>
                    <span className={send.status === "SENT" ? "text-emerald-600" : "text-destructive"}>
                      {send.status === "SENT" ? "Gesendet" : "Fehlgeschlagen"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
