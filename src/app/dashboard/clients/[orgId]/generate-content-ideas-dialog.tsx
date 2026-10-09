"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { generateContentIdeas } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";
import { PYRAMID_STAGE_OPTIONS, type ContentPyramidStageValue } from "@/lib/social/content-pyramid";

type Platform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
type ContentFormatOption = { id: string; name: string };

const PLATFORM_LABELS: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
};

/**
 * "Ideen generieren" - Phase 1 der KI-Content-Maschinerie (siehe
 * src/lib/actions/content-ideas.ts): aus einem eingefügten Text (Transkript,
 * Notizen, Stichpunkte) entstehen pro ausgewählter Plattform N Post-Ideen
 * (Titel + Topic + Format), die als Entwürfe ohne Text im Board unter
 * "Idee" landen. Der eigentliche Beitragstext wird danach pro Idee einzeln
 * über "Text mit KI erstellen" generiert (PostCard/Formular).
 */
export function GenerateContentIdeasDialog({
  organizationId,
  formats,
  prefillInput,
  prefillSourceLabel,
  prefillNonce,
}: {
  organizationId: string;
  formats: ContentFormatOption[];
  /** Von außen gesetzter Quelltext (z.B. ein Call-Transkript, siehe call-transcripts-tab.tsx) - öffnet den Dialog vorausgefüllt. */
  prefillInput?: string | null;
  /** Begleitendes Quelle-Label (z.B. "Fireflies-Call ... vom ...") - landet als ideaSourceLabel auf den erzeugten Beiträgen, siehe social-post-board.tsx. */
  prefillSourceLabel?: string | null;
  /** Bei jedem "Idee daraus generieren"-Klick hochgezählt, auch für denselben Text erneut - löst das Öffnen zuverlässig aus, ohne auf String-Gleichheit angewiesen zu sein. */
  prefillNonce?: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(generateContentIdeas, undefined);
  useSaveToast(error, isPending, "Ideen generiert.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [platforms, setPlatforms] = useState<Platform[]>(["LINKEDIN"]);
  const [formatIds, setFormatIds] = useState<string[]>([]);
  const [pyramidStage, setPyramidStage] = useState<ContentPyramidStageValue>("REACH");
  const [input, setInput] = useState("");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [count, setCount] = useState("10");
  const [consumedPrefillNonce, setConsumedPrefillNonce] = useState(0);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setOpen(false);
      formRef.current?.reset();
      setPlatforms(["LINKEDIN"]);
      setFormatIds([]);
      setPyramidStage("REACH");
      setInput("");
      setSourceLabel(null);
      setCount("10");
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  // Von React empfohlenes Muster fürs Ableiten von State aus einer geänderten
  // Prop direkt im Render, statt setState in einem Effekt aufzurufen -
  // consumedPrefillNonce verhindert ein erneutes Auslösen beim nächsten Render.
  if (prefillInput && prefillNonce && prefillNonce !== consumedPrefillNonce) {
    setConsumedPrefillNonce(prefillNonce);
    setInput(prefillInput);
    setSourceLabel(prefillSourceLabel ?? null);
    setOpen(true);
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  }

  function toggleFormat(id: string) {
    setFormatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <SparklesIcon className="size-4" />
        Ideen generieren
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post-Ideen mit KI generieren</DialogTitle>
          <DialogDescription>
            Aus einem Transkript, Notizen oder Stichpunkten entstehen Post-Ideen je Copywriting-Framework - Volltext
            wird danach pro Idee einzeln erstellt, damit du vorher aussortieren kannst.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="pyramidStage" value={pyramidStage} />
          {sourceLabel && <input type="hidden" name="sourceLabel" value={sourceLabel} />}
          {platforms.map((p) => (
            <input key={p} type="hidden" name="platforms" value={p} />
          ))}
          {formatIds.map((id) => (
            <input key={id} type="hidden" name="formatIds" value={id} />
          ))}

          {sourceLabel && (
            <p className="rounded-md border border-dashed bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              Quelle: {sourceLabel}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <Label>Content-Pyramide: strategische Ausrichtung</Label>
            <div className="flex gap-1.5">
              {PYRAMID_STAGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={pyramidStage === option.value ? "default" : "outline"}
                  onClick={() => setPyramidStage(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {PYRAMID_STAGE_OPTIONS.find((o) => o.value === pyramidStage)?.shortDescription} Ziel-Anteil im Gesamtmix:{" "}
              {PYRAMID_STAGE_OPTIONS.find((o) => o.value === pyramidStage)?.targetPercent}%.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Plattform(en)</Label>
            <div className="flex gap-1.5">
              {(["FACEBOOK", "INSTAGRAM", "LINKEDIN"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={platforms.includes(p) ? "default" : "outline"}
                  onClick={() => togglePlatform(p)}
                >
                  {PLATFORM_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Copywriting-Framework(s)</Label>
            {formats.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Noch keine Copywriting-Frameworks angelegt - unter &bdquo;Copywriting-Frameworks verwalten&ldquo; mindestens eines anlegen.
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                {formats.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={formatIds.includes(f.id)}
                      onChange={() => toggleFormat(f.id)}
                      className="size-4"
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="content-ideas-input">Quelltext (Transkript, Notizen, Stichpunkte)</Label>
            <Textarea
              id="content-ideas-input"
              name="input"
              rows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="z.B. ein Call-Transkript, Sprachnachrichten-Mitschrift oder lose Stichpunkte zum Thema..."
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="content-ideas-count">Anzahl Ideen je Plattform</Label>
            <Input
              id="content-ideas-count"
              name="count"
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-24"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending || formats.length === 0}>
            {isPending ? "Wird generiert..." : "Ideen generieren"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
