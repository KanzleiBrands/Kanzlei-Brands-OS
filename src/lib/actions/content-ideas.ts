"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";

type Platform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN";

const PLATFORM_NOTE: Record<Platform, string> = {
  FACEBOOK: "Facebook (etwas ausführlicher, Emojis in Maßen erlaubt)",
  INSTAGRAM: "Instagram (visuell, Emojis erlaubt, Hashtags am Ende üblich)",
  LINKEDIN: "LinkedIn (professioneller Ton, sparsam mit Emojis, keine übertriebenen Hashtag-Listen)",
};

const GERMAN_ONLY = "Antworte ausschließlich auf Deutsch, unabhängig von der Sprache der Eingabe.";

function isValidPlatform(value: string): value is Platform {
  return value === "FACEBOOK" || value === "INSTAGRAM" || value === "LINKEDIN";
}

/** Strips an optional ```json ... ``` fence Claude sometimes adds despite being told not to. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

type GeneratedIdea = { title: string; topic: string; format: string };

/**
 * Phase 1 der KI-Ideen-Generierung: aus einem Quelltext (Transkript, Notizen,
 * Stichpunkte) werden pro ausgewählter Plattform N Post-Ideen erzeugt -
 * jeweils mit Arbeitstitel, Kurzbeschreibung (Topic) und zugeordnetem Format,
 * aber noch OHNE ausformulierten Text (caption bleibt leer). Die Texterstellung
 * passiert separat pro Idee über generatePostTextFromIdea, damit zwischen
 * beiden Schritten manuell kuratiert werden kann (Formate/Ideen verwerfen,
 * bevor teurere Volltext-Generierung läuft) - siehe content-tab.tsx.
 */
export async function generateContentIdeas(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Ideen generieren.";
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt in den Umgebungsvariablen).";
  }

  const platformsRaw = formData.getAll("platforms").map(String);
  const platforms = platformsRaw.filter(isValidPlatform);
  if (platforms.length === 0) return "Bitte mindestens eine Plattform auswählen.";

  const formatIds = formData.getAll("formatIds").map(String).filter(Boolean);
  if (formatIds.length === 0) return "Bitte mindestens ein Format auswählen.";

  const input = String(formData.get("input") ?? "").trim();
  if (!input) return "Bitte Text/Transkript/Notizen einfügen, auf deren Basis Ideen generiert werden sollen.";

  const count = Number(formData.get("count") ?? 0);
  if (!Number.isInteger(count) || count < 1 || count > 30) return "Anzahl Ideen muss zwischen 1 und 30 liegen.";

  const [organization, formats, channels] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { contentBrandDna: true } }),
    prisma.contentFormat.findMany({ where: { id: { in: formatIds } } }),
    prisma.socialChannel.findMany({ where: { organizationId, platform: { in: platforms }, active: true } }),
  ]);
  if (formats.length === 0) return "Die ausgewählten Formate wurden nicht gefunden.";

  const formatsBlock = formats
    .map((f) => `### Format "${f.name}"\nAnleitung:\n${f.description}\n\nBeispiel(e):\n${f.examples}`)
    .join("\n\n");
  const brandBlock = organization?.contentBrandDna?.trim()
    ? `Marken-DNA des Kunden (unbedingt berücksichtigen):\n${organization.contentBrandDna.trim()}\n\n`
    : "";

  let created = 0;
  const errors: string[] = [];

  for (const platform of platforms) {
    const prompt = `Du hilfst einer Marketing-Agentur, Social-Media-Post-Ideen für einen Kunden zu entwickeln.

${brandBlock}Quelltext (Transkript, Notizen oder Stichpunkte, aus denen Ideen abgeleitet werden sollen):
"""
${input}
"""

Verfügbare Formate (jede Idee muss zu genau einem dieser Formate passen):
${formatsBlock}

Aufgabe: Entwickle genau ${count} unterschiedliche Post-Ideen für ${PLATFORM_NOTE[platform]}, die auf dem Quelltext basieren. Jede Idee besteht aus:
- "title": ein kurzer interner Arbeitstitel (max. 10 Wörter), kein fertiger Post-Text.
- "topic": 2-4 Sätze, die beschreiben, worum es in diesem Post gehen soll und welcher konkrete Gedanke/Aspekt aus dem Quelltext aufgegriffen wird - das ist die Grundlage für die spätere Volltext-Erstellung.
- "format": der exakte Name eines der oben genannten Formate.

${GERMAN_ONLY} Antworte AUSSCHLIESSLICH mit einem validen JSON-Array (keine Markdown-Codeblöcke, keine Erklärungen davor oder danach), z.B.:
[{"title": "...", "topic": "...", "format": "..."}]`;

    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock?.text) throw new Error("Keine Antwort von der KI erhalten.");

      const parsed: unknown = JSON.parse(extractJson(textBlock.text));
      if (!Array.isArray(parsed)) throw new Error("Unerwartetes Antwortformat der KI.");

      const ideas: GeneratedIdea[] = parsed
        .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
        .map((v) => ({
          title: typeof v.title === "string" ? v.title.trim() : "",
          topic: typeof v.topic === "string" ? v.topic.trim() : "",
          format: typeof v.format === "string" ? v.format.trim() : "",
        }))
        .filter((idea) => idea.title && idea.topic);
      if (ideas.length === 0) throw new Error("Die KI hat keine verwertbaren Ideen geliefert.");

      const channel = channels.find((c) => c.platform === platform) ?? null;

      await prisma.socialPost.createMany({
        data: ideas.map((idea) => {
          const format = formats.find((f) => f.name === idea.format) ?? formats[0];
          return {
            organizationId,
            platform,
            caption: "",
            title: idea.title,
            topic: idea.topic,
            contentFormatId: format.id,
            channelId: channel?.id ?? null,
          };
        }),
      });
      created += ideas.length;
    } catch (error) {
      errors.push(`${PLATFORM_NOTE[platform]}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");

  if (created === 0) return `Keine Ideen generiert. ${errors.join(" ")}`;
  if (errors.length > 0) return `${created} Idee(n) generiert, aber Fehler bei: ${errors.join(" ")}`;
  return undefined;
}

/**
 * Phase 2: schreibt den vollständigen Post-Text für eine einzelne, bereits
 * generierte Idee (title/topic/contentFormat müssen gesetzt sein) - das
 * Äquivalent zum "AI erstellen"-Schritt im Referenz-Case. Bewusst getrennt
 * von generateContentIdeas, damit nur die tatsächlich brauchbaren Ideen
 * (nach manueller Durchsicht) den teureren Volltext bekommen.
 */
export async function generatePostTextFromIdea(formData: FormData): Promise<{ error: string } | { caption: string }> {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");

  const post = await prisma.socialPost.findUnique({ where: { id: postId }, include: { contentFormat: true } });
  if (!post) return { error: "Beitrag nicht gefunden." };
  try {
    await assertCanManageSocialContentFor(session, post.organizationId);
  } catch {
    return { error: "Nur Agentur-Admins oder Marketing-Mitarbeiter können Texte generieren." };
  }
  if (!post.title || !post.topic || !post.contentFormat) {
    return { error: "Dieser Beitrag hat keine Ideen-Grundlage (Titel/Topic/Format) für die Texterstellung." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt in den Umgebungsvariablen)." };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: post.organizationId },
    select: { contentBrandDna: true },
  });
  const brandBlock = organization?.contentBrandDna?.trim()
    ? `Marken-DNA des Kunden (unbedingt berücksichtigen):\n${organization.contentBrandDna.trim()}\n\n`
    : "";

  const prompt = `Du schreibst einen fertigen Social-Media-Beitrag für ${PLATFORM_NOTE[post.platform]}.

${brandBlock}Format "${post.contentFormat.name}":
Anleitung:
${post.contentFormat.description}

Beispiel(e) für dieses Format (Stil/Struktur als Vorbild nehmen, Inhalt NICHT kopieren):
${post.contentFormat.examples}

Arbeitstitel dieser Idee: ${post.title}
Worum es gehen soll: ${post.topic}

Aufgabe: Schreibe auf dieser Basis den fertigen, vollständigen Beitragstext gemäß der Format-Anleitung. ${GERMAN_ONLY} Gib NUR den fertigen Beitragstext zurück, ohne Anführungszeichen, Überschriften oder Erklärungen davor oder danach.`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1536,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const caption = textBlock?.text.trim();
    if (!caption) return { error: "Keine Antwort von der KI erhalten." };

    await prisma.socialPost.update({ where: { id: postId }, data: { caption } });

    revalidatePath("/dashboard/social");
    revalidatePath(`/dashboard/clients/${post.organizationId}`);
    revalidatePath("/dashboard/intern/marketing/social");
    return { caption };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }
}

export async function updateContentBrandDna(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können die Marken-DNA bearbeiten.";
  }

  const contentBrandDna = String(formData.get("contentBrandDna") ?? "").trim();
  await prisma.organization.update({ where: { id: organizationId }, data: { contentBrandDna: contentBrandDna || null } });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
  return undefined;
}
