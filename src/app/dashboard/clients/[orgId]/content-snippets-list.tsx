"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { addContentSnippet, deleteContentSnippet } from "@/lib/actions/content-snippets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ContentSnippetCategoryValue = "SIGNATURE" | "CTA" | "HASHTAGS" | "OTHER";

export type ContentSnippetItem = {
  id: string;
  label: string;
  content: string;
  category: ContentSnippetCategoryValue;
};

export const SNIPPET_CATEGORY_OPTIONS: { value: ContentSnippetCategoryValue; label: string }[] = [
  { value: "SIGNATURE", label: "Signatur" },
  { value: "CTA", label: "CTA" },
  { value: "HASHTAGS", label: "Hashtag-Set" },
  { value: "OTHER", label: "Sonstiges" },
];

/**
 * Wiederverwendbare Textbausteine pro Kunde (Konfiguration-Reiter) -
 * Signaturen/CTAs/Hashtag-Sets, die sich im Post-Editor per Klick einfügen
 * lassen statt bei jedem Beitrag neu getippt zu werden. Siehe
 * social-post-form-dialog.tsx für das Einfügen.
 */
export function ContentSnippetsList({ organizationId, snippets }: { organizationId: string; snippets: ContentSnippetItem[] }) {
  const [error, formAction, isPending] = useActionState(addContentSnippet, undefined);
  useSaveToast(error, isPending, "Textbaustein hinzugefügt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [category, setCategory] = useState<ContentSnippetCategoryValue>("CTA");
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startDelete(() => deleteContentSnippet(fd));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Signaturen, CTAs oder Hashtag-Sets, die sich im Post-Editor per Klick einfügen lassen, statt sie jedes Mal neu
        zu tippen.
      </p>

      {snippets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {snippets.map((s) => (
            <div key={s.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium uppercase text-muted-foreground">
                    {SNIPPET_CATEGORY_OPTIONS.find((o) => o.value === s.category)?.label}
                  </span>
                  <span className="font-medium">{s.label}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{s.content}</p>
              </div>
              <button
                type="button"
                aria-label="Entfernen"
                disabled={isDeleting}
                onClick={() => handleDelete(s.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="category" value={category} />
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v as ContentSnippetCategoryValue)}>
              <SelectTrigger className="w-32">
                <SelectValue>{(v: ContentSnippetCategoryValue) => SNIPPET_CATEGORY_OPTIONS.find((o) => o.value === v)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SNIPPET_CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="content-snippet-label">Bezeichnung</Label>
            <Input id="content-snippet-label" name="label" placeholder="z.B. Standard-CTA Bewerbung" required />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="content-snippet-content">Text</Label>
          <Textarea id="content-snippet-content" name="content" rows={3} placeholder="Der einzufügende Text..." required />
        </div>
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
