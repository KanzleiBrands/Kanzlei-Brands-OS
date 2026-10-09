"use client";

import { useState, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * Textarea, die eingeklappt nur eine kompakte Höhe zeigt (scrollbar) und sich
 * erst beim Reinklicken auf eine lesbare Höhe ausklappt - für Freitextfelder,
 * die sehr lang werden können (Marken-DNA, Copywriting-Framework-Anleitungen),
 * damit sie die Seite im Ruhezustand nicht sprengen. Überschreibt bewusst
 * field-sizing-content von Textarea (das sonst immer auf volle Inhaltshöhe
 * wächst) mit field-sizing-fixed, damit "rows" wirklich die Höhe bestimmt.
 */
export function CollapsibleTextarea({
  collapsedRows = 3,
  expandedRows = 16,
  className,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof Textarea> & { collapsedRows?: number; expandedRows?: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <Textarea
      rows={focused ? expandedRows : collapsedRows}
      className={`field-sizing-fixed resize-y overflow-y-auto transition-[height] duration-150 ${className ?? ""}`}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
