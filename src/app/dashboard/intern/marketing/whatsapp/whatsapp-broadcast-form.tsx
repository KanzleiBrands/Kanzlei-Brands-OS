"use client";

import { useActionState, useState } from "react";
import { sendWhatsAppBroadcast } from "@/lib/actions/whatsapp-send";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveToast } from "@/hooks/use-save-toast";

type Template = { name: string; language: string; category: string };
type Channel = { id: string; displayName: string; templates: Template[] };

export function WhatsAppBroadcastForm({ channels }: { channels: Channel[] }) {
  const [error, formAction, isPending] = useActionState(sendWhatsAppBroadcast, undefined);
  useSaveToast(error, isPending);

  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId);
  const [templateKey, setTemplateKey] = useState<string>("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Kanal</Label>
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
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vorlage</Label>
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
            <p className="text-xs text-muted-foreground">
              Keine genehmigte Vorlage für diesen Kanal - lege eine in der Meta Business Suite an.
            </p>
          )}
          <input type="hidden" name="templateName" value={templateKey.split("|")[0] ?? ""} />
          <input type="hidden" name="languageCode" value={templateKey.split("|")[1] ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="whatsapp-recipients">Empfänger (eine Telefonnummer pro Zeile, mit Ländervorwahl)</Label>
        <Textarea id="whatsapp-recipients" name="recipients" rows={4} placeholder={"+49151...\n+49160..."} required />
      </div>

      {error && <p className={`text-sm ${error.status === "error" ? "text-destructive" : "text-emerald-600"}`}>{error.message}</p>}

      <Button type="submit" disabled={isPending || !channelId || !templateKey} className="w-fit">
        {isPending ? "Wird verschickt..." : "Verschicken"}
      </Button>
    </form>
  );
}
