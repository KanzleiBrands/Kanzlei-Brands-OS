"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ExternalLinkIcon, Trash2Icon, SparklesIcon, Loader2Icon } from "lucide-react";
import {
  addReferenceAccount,
  deleteReferenceAccount,
  toggleReferenceAccountScan,
  syncReferenceAccountNow,
} from "@/lib/actions/content-reference-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ReferenceAccountPlatformValue = "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "OTHER";

export type ContentReferenceAccountItem = {
  id: string;
  platform: ReferenceAccountPlatformValue;
  handle: string;
  displayName: string | null;
  scanEnabled: boolean;
  lastAnalysis: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

const PLATFORM_OPTIONS: { value: ReferenceAccountPlatformValue; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "OTHER", label: "Sonstiges" },
];

function AccountRow({ account }: { account: ContentReferenceAccountItem }) {
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const isInstagram = account.platform === "INSTAGRAM";
  const looksLikeUrl = /^https?:\/\//.test(account.handle);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium uppercase text-muted-foreground">
          {PLATFORM_OPTIONS.find((p) => p.value === account.platform)?.label}
        </span>
        {looksLikeUrl ? (
          <a
            href={account.handle}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate hover:underline"
          >
            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{account.displayName || account.handle}</span>
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate">{account.displayName || `@${account.handle}`}</span>
        )}
        <button
          type="button"
          aria-label="Entfernen"
          disabled={isPending}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", account.id);
            startTransition(() => deleteReferenceAccount(fd));
          }}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>

      {isInstagram && (
        <div className="flex flex-wrap items-center gap-3 pl-0.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              defaultChecked={account.scanEnabled}
              disabled={isPending}
              onCheckedChange={() => {
                const fd = new FormData();
                fd.set("id", account.id);
                startTransition(() => toggleReferenceAccountScan(fd));
              }}
            />
            Automatisch im Hintergrund scannen
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSyncing}
            onClick={() => {
              const fd = new FormData();
              fd.set("id", account.id);
              startSyncTransition(() => syncReferenceAccountNow(fd));
            }}
          >
            {isSyncing ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
            Jetzt scannen
          </Button>
          {account.lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Zuletzt gescannt: {new Date(account.lastSyncedAt).toLocaleString("de-DE")}
            </span>
          )}
        </div>
      )}

      {account.lastSyncError && <p className="text-xs text-destructive">{account.lastSyncError}</p>}

      {account.lastAnalysis && (
        <div className="pl-0.5">
          <button
            type="button"
            onClick={() => setShowAnalysis((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showAnalysis ? "Analyse ausblenden" : "Analyse anzeigen"}
          </button>
          {showAnalysis && <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">{account.lastAnalysis}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Referenz-/Vorbild-Accounts für die Ideen-Generierung - anders als
 * ContentReferenceDocsList (reine Link-Ablage) lassen sich Instagram-
 * Accounts hier zusätzlich automatisch im Hintergrund scannen (Metas
 * "Business Discovery", siehe content-reference-accounts.ts): die KI
 * analysiert die erfolgreichsten Posts auf übertragbare Muster (Format/Hook/
 * Aufbau), NICHT auf das Thema - die Analyse fließt dann in
 * generateContentIdeas ein. Für Facebook/LinkedIn/Sonstiges gibt es keine
 * vergleichbare, ToS-konforme API für fremde Accounts - die bleiben reine
 * Link-Referenz. Der Scan ist bewusst standardmäßig aus (scanEnabled=false).
 */
export function ContentReferenceAccountsList({
  organizationId,
  accounts,
}: {
  organizationId: string;
  accounts: ContentReferenceAccountItem[];
}) {
  const [error, formAction, isPending] = useActionState(addReferenceAccount, undefined);
  useSaveToast(error, isPending, "Referenz-Account hinzugefügt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [platform, setPlatform] = useState<ReferenceAccountPlatformValue>("INSTAGRAM");

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        3-5 Vorbild-Accounts, an deren Format/Aufbau/Stil man sich orientieren will - nicht zwingend aus der gleichen
        Branche. Instagram-Accounts lassen sich automatisch scannen (braucht einen verbundenen Instagram-Kanal für
        diesen Kunden); für andere Plattformen dient der Link als reine Inspiration.
      </p>

      {accounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="flex flex-col gap-1">
          <Label>Plattform</Label>
          <input type="hidden" name="platform" value={platform} />
          <Select value={platform} onValueChange={(v) => v && setPlatform(v as ReferenceAccountPlatformValue)}>
            <SelectTrigger className="w-36">
              <SelectValue>{(v: ReferenceAccountPlatformValue) => PLATFORM_OPTIONS.find((p) => p.value === v)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="ref-account-handle">{platform === "INSTAGRAM" ? "Instagram-Nutzername" : "Profil-Link"}</Label>
          <Input
            id="ref-account-handle"
            name="handle"
            placeholder={platform === "INSTAGRAM" ? "z.B. beispielaccount" : "https://..."}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="ref-account-name">Name (optional)</Label>
          <Input id="ref-account-name" name="displayName" placeholder="Interne Bezeichnung" />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
