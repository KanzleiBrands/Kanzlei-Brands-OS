"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { assistEmailContent, type EmailAiMode } from "@/lib/actions/email-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TONES = ["Locker", "Professionell", "Enthusiastisch", "Sachlich"] as const;

/**
 * KI-Schreibassistent im E-Mail-Marketing-Schritt-Editor (Claude-gestützt,
 * analog zum Social-Media-Assistenten) - E-Mail generieren/umschreiben/
 * kürzen/verlängern, Ton ändern, Betreffzeilen vorschlagen. Antworten sind
 * immer auf Deutsch - siehe src/lib/actions/email-ai.ts.
 */
export function EmailAiAssistant({
  bodyText,
  onInsertSubject,
  onInsertBody,
}: {
  bodyText: string;
  onInsertSubject: (text: string) => void;
  onInsertBody: (text: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<EmailAiMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [subjectIdeas, setSubjectIdeas] = useState<string[] | null>(null);

  function run(mode: EmailAiMode, instruction?: string) {
    setError(null);
    setSubjectIdeas(null);
    setPendingMode(mode);
    startTransition(async () => {
      const result = await assistEmailContent({ mode, bodyText, instruction });
      setPendingMode(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("subjects" in result) {
        setSubjectIdeas(result.subjects);
        return;
      }
      if ("subject" in result) {
        onInsertSubject(result.subject);
        onInsertBody(result.bodyText);
        return;
      }
      onInsertBody(result.text);
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
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("subjectIdeas")}>
          {isPending && pendingMode === "subjectIdeas" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Betreffvorschläge
        </Button>
      </div>

      {subjectIdeas && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Vorschlag übernehmen:</span>
          <div className="flex flex-wrap gap-1.5">
            {subjectIdeas.map((idea, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onInsertSubject(idea);
                  setSubjectIdeas(null);
                }}
                className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}

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
      </div>

      <div className="flex gap-1.5">
        <Input
          placeholder="Thema für neue E-Mail..."
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
