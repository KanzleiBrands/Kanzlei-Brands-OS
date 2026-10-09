"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { generateBlogPostIdeas } from "@/lib/actions/blog-posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

/**
 * "Ideen generieren" für Blogartikel - spiegelt generate-content-ideas-
 * dialog.tsx (Social Media), nur ohne Plattform/Format/Pyramide-Stufe, da
 * ein Blogartikel kein Plattform-Posting ist. prefillInput/prefillSourceLabel
 * erlauben, Ideen auch aus einem Call-Transkript zu übernehmen (dieselbe
 * Mechanik wie bei der Social-Media-Ideen-Generierung) - aktuell nur per Prop
 * verdrahtet, ein Picker dafür kann analog zu call-transcripts-tab.tsx ergänzt werden.
 */
export function BlogGenerateIdeasDialog() {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(generateBlogPostIdeas, undefined);
  useSaveToast(error, isPending, "Ideen generiert.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [input, setInput] = useState("");
  const [count, setCount] = useState("3");

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setOpen(false);
      formRef.current?.reset();
      setInput("");
      setCount("3");
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <SparklesIcon className="size-4" />
        Ideen generieren
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Blogartikel-Ideen mit KI generieren</DialogTitle>
          <DialogDescription>
            Aus einem Thema, Stichpunkten oder einem Transkript entstehen Blogartikel-Ideen - der volle Text wird danach pro
            Idee einzeln erstellt.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="blog-ideas-input">Thema, Stichpunkte oder Transkript</Label>
            <Textarea
              id="blog-ideas-input"
              name="input"
              rows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="z.B. ein Thema, zu dem ihr ranken wollt, oder Stichpunkte aus einem Mandanten-/Sales-Gespräch..."
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="blog-ideas-count">Anzahl Ideen</Label>
            <Input
              id="blog-ideas-count"
              name="count"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-24"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird generiert..." : "Ideen generieren"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
