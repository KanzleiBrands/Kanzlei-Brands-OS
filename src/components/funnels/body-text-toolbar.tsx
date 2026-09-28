"use client";

import type { RefObject } from "react";
import { BoldIcon, ItalicIcon, LinkIcon } from "lucide-react";

function wrapSelection(
  textarea: HTMLTextAreaElement | null,
  value: string,
  setValue: (next: string) => void,
  before: string,
  after: string,
  placeholder: string,
) {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
  setValue(next);
  requestAnimationFrame(() => {
    textarea?.focus();
    const selectionStart = start + before.length;
    textarea?.setSelectionRange(selectionStart, selectionStart + selected.length);
  });
}

const BUTTON_CLASS =
  "flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";

/**
 * Fett/Kursiv/Link-Buttons für den E-Mail-Body-Textarea - schreiben die
 * minimale Markdown-ähnliche Syntax (**fett**, *kursiv*, [Text](url)), die
 * src/lib/funnels/render.ts beim Versand/in der Vorschau interpretiert.
 * Kein echter Rich-Text-Editor, da das gespeicherte bodyText bewusst
 * einfacher Text bleiben soll (siehe render.ts).
 */
export function BodyTextToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="Fett"
        aria-label="Fett"
        onClick={() => wrapSelection(textareaRef.current, value, onChange, "**", "**", "fett")}
        className={BUTTON_CLASS}
      >
        <BoldIcon className="size-3.5" />
      </button>
      <button
        type="button"
        title="Kursiv"
        aria-label="Kursiv"
        onClick={() => wrapSelection(textareaRef.current, value, onChange, "*", "*", "kursiv")}
        className={BUTTON_CLASS}
      >
        <ItalicIcon className="size-3.5" />
      </button>
      <button
        type="button"
        title="Link einfügen"
        aria-label="Link einfügen"
        onClick={() => {
          const url = window.prompt("Link-URL (https://...)");
          if (!url) return;
          wrapSelection(textareaRef.current, value, onChange, "[", `](${url})`, "Linktext");
        }}
        className={BUTTON_CLASS}
      >
        <LinkIcon className="size-3.5" />
      </button>
    </div>
  );
}
