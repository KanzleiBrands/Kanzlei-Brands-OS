"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, SparklesIcon, RefreshCwIcon, CheckCircle2Icon, XCircleIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addGeoMonitoredPrompt, removeGeoMonitoredPrompt, triggerGeoVisibilityCheckNow } from "@/lib/actions/seo-geo";
import { createBlogIdeaFromGeoGap } from "@/lib/actions/blog-posts";

export type GeoProviderValue = "CHATGPT" | "CLAUDE" | "GEMINI" | "PERPLEXITY";
export type GeoCheckItem = { provider: GeoProviderValue; mentioned: boolean; cited: boolean; citedUrl: string | null; checkedAt: string };
export type GeoPromptItem = { id: string; prompt: string; label: string | null; checks: GeoCheckItem[] };

const PROVIDERS: { value: GeoProviderValue; label: string }[] = [
  { value: "CHATGPT", label: "ChatGPT" },
  { value: "CLAUDE", label: "Claude" },
  { value: "GEMINI", label: "Gemini" },
  { value: "PERPLEXITY", label: "Perplexity" },
];

function ProviderBadge({ check, label }: { check: GeoCheckItem | undefined; label: string }) {
  if (!check) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground">{label}: noch nicht geprüft</span>
    );
  }
  if (check.cited) {
    return (
      <span
        className="flex items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-1 text-xs text-emerald-500"
        title={check.citedUrl ?? undefined}
      >
        <CheckCircle2Icon className="size-3.5" />
        {label}: zitiert
      </span>
    );
  }
  if (check.mentioned) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-500">
        <CheckCircle2Icon className="size-3.5" />
        {label}: genannt
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-muted-foreground">
      <XCircleIcon className="size-3.5" />
      {label}: nicht gefunden
    </span>
  );
}

function PromptRow({ item }: { item: GeoPromptItem }) {
  const [isCreating, startCreating] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const anyMentioned = item.checks.some((c) => c.mentioned);
  const anyChecked = item.checks.length > 0;

  function handleCreateIdea() {
    startCreating(async () => {
      const fd = new FormData();
      fd.set("promptId", item.id);
      const result = await createBlogIdeaFromGeoGap(fd);
      if (result?.error) toast.error(result.error);
      else toast.success("Idee erstellt.");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{item.prompt}</p>
          {item.label && <p className="text-xs text-muted-foreground">{item.label}</p>}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={isRemoving}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", item.id);
            startRemoving(() => removeGeoMonitoredPrompt(fd));
          }}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PROVIDERS.map((p) => (
          <ProviderBadge key={p.value} check={item.checks.find((c) => c.provider === p.value)} label={p.label} />
        ))}
      </div>
      {anyChecked && !anyMentioned && (
        <Button type="button" size="sm" variant="outline" className="self-start" disabled={isCreating} onClick={handleCreateIdea}>
          <SparklesIcon className="size-4" />
          Idee daraus erstellen (noch nirgends genannt)
        </Button>
      )}
    </div>
  );
}

/**
 * GEO-Sichtbarkeit: prüft, ob die Marke bei typischen Mandanten-Fragen von
 * ChatGPT/Claude/Gemini/Perplexity genannt bzw. zitiert wird (siehe
 * seo-geo.ts) - das eigentliche "werden wir von der KI empfohlen"-Ziel, nicht
 * nur klassisches SEO-Ranking.
 */
export function GeoVisibilityList({ prompts, brandNameConfigured }: { prompts: GeoPromptItem[]; brandNameConfigured: boolean }) {
  const [isAdding, startAdding] = useTransition();
  const [isChecking, startChecking] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [label, setLabel] = useState("");

  function handleAdd() {
    if (!prompt.trim()) return;
    const fd = new FormData();
    fd.set("prompt", prompt.trim());
    fd.set("label", label.trim());
    startAdding(async () => {
      await addGeoMonitoredPrompt(fd);
      setPrompt("");
      setLabel("");
    });
  }

  function handleCheckNow() {
    startChecking(async () => {
      const result = await triggerGeoVisibilityCheckNow();
      if (result.error) toast.error(result.error);
      else toast.success(`${result.checked} Abfrage(n) durchgeführt.`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!brandNameConfigured && (
        <p className="rounded-md border border-dashed bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          Bitte zuerst den Markennamen in der Konfiguration setzen (für die Erwähnungs-Erkennung in den KI-Antworten).
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm font-medium">Überwachte Fragen</p>
        <p className="text-xs text-muted-foreground">
          Typische Fragen, die potenzielle Mandanten ChatGPT/Claude/Gemini/Perplexity stellen könnten, z.B. &quot;Welche Kanzlei hilft
          bei Abmahnungen wegen Markenrecht?&quot;.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-muted-foreground">Frage/Prompt</label>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="z.B. Welche Kanzlei hilft bei..." />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Bezeichnung (optional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Markenrecht" className="w-48" />
          </div>
          <Button type="button" size="sm" disabled={isAdding || !prompt.trim()} onClick={handleAdd}>
            <PlusIcon className="size-4" />
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isChecking || prompts.length === 0} onClick={handleCheckNow}>
          <RefreshCwIcon className={`size-4 ${isChecking ? "animate-spin" : ""}`} />
          Jetzt bei allen 4 Modellen prüfen
        </Button>
        <p className="text-xs text-muted-foreground">
          <LinkIcon className="mr-1 inline size-3" />
          Fragt pro Prompt ChatGPT, Claude, Gemini UND Perplexity ab - kostet bei jedem Lauf echtes Geld.
        </p>
      </div>

      {prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Fragen hinterlegt.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {prompts.map((item) => (
            <PromptRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
