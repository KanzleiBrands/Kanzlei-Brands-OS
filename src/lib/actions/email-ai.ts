"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/access";

const EMAIL_AI_MODES = ["generate", "rewrite", "shorten", "lengthen", "tone", "subjectIdeas"] as const;
export type EmailAiMode = (typeof EMAIL_AI_MODES)[number];

const GERMAN_ONLY = "Antworte ausschließlich auf Deutsch, unabhängig von der Sprache der Eingabe.";

function buildPrompt(mode: EmailAiMode, bodyText: string, instruction: string): string {
  switch (mode) {
    case "generate":
      return `Schreibe eine neue Marketing-E-Mail zum Thema: "${instruction}". ${GERMAN_ONLY} Gib die Antwort in genau diesem Format zurück, ohne weitere Erklärungen:\nBETREFF: <Betreffzeile>\nTEXT:\n<E-Mail-Text, Links im Format [Linktext](https://...)>`;
    case "rewrite":
      return `Schreibe den folgenden Marketing-E-Mail-Text um - gleicher Sinn, neue Formulierung. ${GERMAN_ONLY} Gib NUR den neuen Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${bodyText}`;
    case "shorten":
      return `Kürze den folgenden Marketing-E-Mail-Text deutlich, ohne die Kernaussage zu verlieren. ${GERMAN_ONLY} Gib NUR den gekürzten Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${bodyText}`;
    case "lengthen":
      return `Erweitere den folgenden Marketing-E-Mail-Text um mehr Details, ohne den Stil zu verändern. ${GERMAN_ONLY} Gib NUR den erweiterten Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${bodyText}`;
    case "tone":
      return `Ändere den Ton des folgenden Marketing-E-Mail-Texts zu "${instruction}". ${GERMAN_ONLY} Gib NUR den neuen Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${bodyText}`;
    case "subjectIdeas":
      return `Schlage 3 knackige Betreffzeilen für die folgende Marketing-E-Mail vor, die zum Öffnen anregen. ${GERMAN_ONLY} Gib NUR die 3 Betreffzeilen zurück, je eine pro Zeile, ohne Nummerierung oder Erklärungen.\n\nE-Mail-Text:\n${bodyText}`;
  }
}

function parseGenerated(raw: string): { subject: string; bodyText: string } | null {
  const subjectMatch = raw.match(/BETREFF:\s*(.+)/i);
  const textMatch = raw.match(/TEXT:\s*([\s\S]*)/i);
  if (!subjectMatch || !textMatch) return null;
  return { subject: subjectMatch[1].trim(), bodyText: textMatch[1].trim() };
}

export type EmailAiResult =
  | { text: string }
  | { subject: string; bodyText: string }
  | { subjects: string[] }
  | { error: string };

/**
 * Server-side Claude call for den E-Mail-Marketing-Schritt-Editor (E-Mail-
 * Marketing-Funnel, sowohl Kunden-Hub als auch internes Marketing-Center) -
 * generieren, umschreiben, kürzen, verlängern, Ton ändern, Betreffzeilen
 * vorschlagen. Antworten sind immer auf Deutsch (siehe GERMAN_ONLY). Requires
 * ANTHROPIC_API_KEY, siehe src/lib/actions/social-ai.ts für dieselbe Regel.
 */
export async function assistEmailContent(input: {
  mode: EmailAiMode;
  bodyText: string;
  instruction?: string;
}): Promise<EmailAiResult> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return { error: "Nur Agentur-Admins können den KI-Assistenten nutzen." };
  }
  if (!EMAIL_AI_MODES.includes(input.mode)) {
    return { error: "Unbekannter Modus." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt in den Umgebungsvariablen)." };
  }
  if ((input.mode === "generate" || input.mode === "tone") && !input.instruction?.trim()) {
    return { error: "Bitte zuerst ein Thema bzw. einen Ton angeben." };
  }
  if (input.mode !== "generate" && !input.bodyText.trim()) {
    return { error: "Bitte zuerst einen Text eingeben." };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(input.mode, input.bodyText, input.instruction ?? "") }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock?.text.trim();
    if (!raw) return { error: "Keine Antwort von der KI erhalten." };

    if (input.mode === "generate") {
      const parsed = parseGenerated(raw);
      if (!parsed) return { error: "KI-Antwort konnte nicht gelesen werden." };
      return parsed;
    }
    if (input.mode === "subjectIdeas") {
      const subjects = raw
        .split("\n")
        .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
      if (subjects.length === 0) return { error: "Keine Betreffvorschläge erhalten." };
      return { subjects };
    }
    return { text: raw };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }
}
