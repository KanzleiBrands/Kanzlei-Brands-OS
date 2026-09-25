"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { assistSocialCaption, type SocialAiMode } from "@/lib/actions/social-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TONES = ["Locker", "Professionell", "Enthusiastisch", "Sachlich"] as const;
const LANGUAGES = ["Englisch", "Französisch", "Spanisch"] as const;

/**
 * KI-Schreibassistent im Post-Editor (Claude-gestützt, wie SocialPilots "AI
 * Pilot"): Text generieren/umschreiben/kürzen/verlängern, Ton ändern,
 * übersetzen, Hashtags vorschlagen - siehe src/lib/actions/social-ai.ts.
 */
export function AiCaptionAssistant({
  caption,
  platform,
  onInsert,
}: {
  caption: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  onInsert: (text: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<SocialAiMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState("");

  function run(mode: SocialAiMode, instruction?: string) {
    setError(null);
    setPendingMode(mode);
    startTransition(async () => {
      const result = await assistSocialCaption({ mode, caption, platform, instruction });
      setPendingMode(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (mode === "hashtags") {
        onInsert(caption.trim() ? `${caption.trim()}\n\n${result.text}` : result.text);
      } else {
        onInsert(result.text);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="size-4 text-primary" />
        KI-Assistent
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("rewrite")}>
          {isPending && pendingMode === "rewrite" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Umschreiben
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("shorten")}>
          {isPending && pendingMode === "shorten" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Kürzen
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("lengthen")}>
          {isPending && pendingMode === "lengthen" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Verlängern
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("hashtags")}>
          {isPending && pendingMode === "hashtags" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Hashtags vorschlagen
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={tone} onValueChange={(v) => setTone(v ?? "")}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue>{() => tone || "Ton wählen"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" disabled={isPending || !tone} onClick={() => run("tone", tone)}>
          {isPending && pendingMode === "tone" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Anwenden
        </Button>

        <Select value={language} onValueChange={(v) => setLanguage(v ?? "")}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue>{() => language || "Sprache wählen"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !language}
          onClick={() => run("translate", language)}
        >
          {isPending && pendingMode === "translate" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Übersetzen
        </Button>
      </div>

      <div className="flex gap-1.5">
        <Input
          placeholder="Thema für neuen Text..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-8"
        />
        <Button type="button" size="sm" disabled={isPending || !topic.trim()} onClick={() => run("generate", topic)}>
          {isPending && pendingMode === "generate" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Generieren
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
