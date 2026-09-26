"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/access";

const AI_MODES = ["generate", "rewrite", "shorten", "lengthen", "tone", "hashtags"] as const;
export type SocialAiMode = (typeof AI_MODES)[number];

const GERMAN_ONLY = "Antworte ausschließlich auf Deutsch, unabhängig von der Sprache der Eingabe.";

const PLATFORM_NOTE: Record<"FACEBOOK" | "INSTAGRAM" | "LINKEDIN", string> = {
  FACEBOOK: "Facebook (etwas ausführlicher, Emojis in Maßen erlaubt)",
  INSTAGRAM: "Instagram (visuell, Emojis erlaubt, Hashtags am Ende üblich)",
  LINKEDIN: "LinkedIn (professioneller Ton, sparsam mit Emojis, keine übertriebenen Hashtag-Listen)",
};

function buildPrompt(
  mode: SocialAiMode,
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN",
  caption: string,
  instruction: string,
): string {
  const platformNote = PLATFORM_NOTE[platform];
  switch (mode) {
    case "generate":
      return `Schreibe einen neuen Social-Media-Beitragstext für ${platformNote} zum Thema: "${instruction}". ${GERMAN_ONLY} Gib NUR den fertigen Text zurück, ohne Anführungszeichen oder Erklärungen.`;
    case "rewrite":
      return `Schreibe den folgenden Social-Media-Beitragstext für ${platformNote} um - gleicher Sinn, neue Formulierung. ${GERMAN_ONLY} Gib NUR den neuen Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${caption}`;
    case "shorten":
      return `Kürze den folgenden Social-Media-Beitragstext für ${platformNote} deutlich, ohne die Kernaussage zu verlieren. ${GERMAN_ONLY} Gib NUR den gekürzten Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${caption}`;
    case "lengthen":
      return `Erweitere den folgenden Social-Media-Beitragstext für ${platformNote} um mehr Details, ohne den Stil zu verändern. ${GERMAN_ONLY} Gib NUR den erweiterten Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${caption}`;
    case "tone":
      return `Ändere den Ton des folgenden Social-Media-Beitragstexts für ${platformNote} zu "${instruction}". ${GERMAN_ONLY} Gib NUR den neuen Text zurück, ohne Anführungszeichen oder Erklärungen.\n\nText:\n${caption}`;
    case "hashtags":
      return `Schlage 5 bis 8 relevante deutsche Hashtags für den folgenden Social-Media-Beitragstext für ${platformNote} vor. Gib NUR die Hashtags durch Leerzeichen getrennt zurück, jeweils mit # beginnend, keine Erklärungen.\n\nText:\n${caption}`;
  }
}

/**
 * Server-side Claude call for the post editor's writing assistant (generate,
 * rewrite, shorten, lengthen, change tone, translate, suggest hashtags).
 * Requires ANTHROPIC_API_KEY in the deployment's environment - not part of
 * this app's existing integrations, so this fails with a clear message
 * instead of a stack trace when it's unset (e.g. in a fresh environment).
 */
export async function assistSocialCaption(input: {
  mode: SocialAiMode;
  caption: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";
  instruction?: string;
}): Promise<{ text: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return { error: "Nur Agentur-Admins können den KI-Assistenten nutzen." };
  }
  if (!AI_MODES.includes(input.mode)) {
    return { error: "Unbekannter Modus." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt in den Umgebungsvariablen)." };
  }
  if ((input.mode === "generate" || input.mode === "tone") && !input.instruction?.trim()) {
    return { error: "Bitte zuerst ein Thema bzw. einen Ton angeben." };
  }
  if (input.mode !== "generate" && !input.caption.trim()) {
    return { error: "Bitte zuerst einen Text eingeben." };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input.mode, input.platform, input.caption, input.instruction ?? "") }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text.trim();
    if (!text) return { error: "Keine Antwort von der KI erhalten." };
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }
}
