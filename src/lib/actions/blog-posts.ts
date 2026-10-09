"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getAnthropicClient } from "@/lib/anthropic";

/**
 * Blog-/SEO-Content-Pipeline (v1, nur intern) - spiegelt bewusst die
 * zweiphasige KI-Maschinerie aus content-ideas.ts (erst Ideen, dann erst auf
 * Wunsch der volle Text), aber für Volltext-Blogartikel statt kurzer Social-
 * Captions, siehe BlogPost-Modell. Freigabe-/Status-Logik spiegelt
 * social-posts.ts (moveSocialPostStatus/approveSocialPost/
 * requestSocialPostChanges) - nur ohne Kunde, da diese Pipeline (v1)
 * ausschließlich intern läuft.
 */

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";
const GERMAN_ONLY = "Antworte ausschließlich auf Deutsch, unabhängig von der Sprache der Eingabe.";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function requireAgencyAdmin(role: string): void {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base || "beitrag";
  let suffix = 2;
  for (;;) {
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${suffix}`;
    suffix++;
  }
}

type GeneratedBlogIdea = { title: string; topic: string; targetKeyword: string };

async function generateIdeasFromInput(input: string, count: number): Promise<GeneratedBlogIdea[]> {
  const prompt = `Du hilfst einer Kanzlei-Marketing-Agentur, Themen für Blogartikel (SEO) zu entwickeln.

Quelltext (Transkript, Notizen, Content-Lücke oder Stichpunkte, aus denen Themen abgeleitet werden sollen):
"""
${input}
"""

Aufgabe: Entwickle genau ${count} unterschiedliche Blogartikel-Ideen, die auf dem Quelltext basieren und für organisches Suchmaschinen-Ranking (SEO) UND KI-Antworten (ChatGPT, Google AI) geeignet sind - klare Antworten, konkrete Zahlen/Beispiele statt vager Aussagen. Jede Idee besteht aus:
- "title": ein konkreter Arbeitstitel (max. 12 Wörter).
- "topic": 3-5 Sätze, die beschreiben, welche Fragen der Artikel beantwortet und welcher Blickwinkel aus dem Quelltext aufgegriffen wird.
- "targetKeyword": das Haupt-Suchbegriff/Keyword, auf das der Artikel optimiert werden soll.

${GERMAN_ONLY} Antworte AUSSCHLIESSLICH mit einem validen JSON-Array (keine Markdown-Codeblöcke, keine Erklärungen davor oder danach), z.B.:
[{"title": "...", "topic": "...", "targetKeyword": "..."}]`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) throw new Error("Keine Antwort von der KI erhalten.");

  const parsed: unknown = JSON.parse(extractJson(textBlock.text));
  if (!Array.isArray(parsed)) throw new Error("Unerwartetes Antwortformat der KI.");

  return parsed
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      title: typeof v.title === "string" ? v.title.trim() : "",
      topic: typeof v.topic === "string" ? v.topic.trim() : "",
      targetKeyword: typeof v.targetKeyword === "string" ? v.targetKeyword.trim() : "",
    }))
    .filter((idea) => idea.title && idea.topic);
}

/**
 * Phase 1: aus einem Quelltext (manuell eingefügt oder aus einem Call-
 * Transkript übernommen, siehe call-transcripts-tab.tsx - dieselbe
 * prefillInput/prefillSourceLabel-Mechanik wie bei generateContentIdeas)
 * entstehen Blogartikel-Ideen als Entwürfe ohne Inhalt.
 */
export async function generateBlogPostIdeas(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return "Nur Agentur-Admins können Blogartikel-Ideen generieren.";
  }
  if (!process.env.ANTHROPIC_API_KEY) return "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).";

  const input = String(formData.get("input") ?? "").trim();
  if (!input) return "Bitte Text/Thema einfügen, auf dessen Basis Ideen generiert werden sollen.";
  const count = Number(formData.get("count") ?? 0);
  if (!Number.isInteger(count) || count < 1 || count > 10) return "Anzahl Ideen muss zwischen 1 und 10 liegen.";
  const sourceLabelRaw = String(formData.get("sourceLabel") ?? "").trim();
  const ideaSourceLabel = sourceLabelRaw || null;

  try {
    const ideas = await generateIdeasFromInput(input, count);
    if (ideas.length === 0) return "Die KI hat keine verwertbaren Ideen geliefert.";

    await prisma.blogPost.createMany({
      data: ideas.map((idea) => ({ title: idea.title, topic: idea.topic, targetKeyword: idea.targetKeyword, ideaSourceLabel })),
    });
  } catch (error) {
    return error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen.";
  }

  revalidatePath(SEO_TAB_PATH);
  return undefined;
}

/** Ein-Klick-Idee aus einer Content-Lücke (siehe seo-gaps.ts) - markiert die Lücke als aufgegriffen. */
export async function createBlogIdeaFromGap(formData: FormData): Promise<{ error: string } | undefined> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return { error: "Nur Agentur-Admins können Blogartikel-Ideen generieren." };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." };

  const gapId = String(formData.get("gapId") ?? "");
  const gap = await prisma.seoContentGap.findUnique({ where: { id: gapId } });
  if (!gap) return { error: "Content-Lücke nicht gefunden." };

  const input = `Google Search Console zeigt für die eigene Seite Impressionen für die Suchanfrage "${gap.query}" (durchschnittliche Position ${gap.avgPosition.toFixed(1)}, ${gap.impressions} Impressionen, ${gap.clicks} Klicks in den letzten 28 Tagen), aber es gibt noch keinen dedizierten, gut rankenden Beitrag dafür. Entwickle einen Blogartikel, der dieses Thema umfassend und klar beantwortet.`;

  try {
    const ideas = await generateIdeasFromInput(input, 1);
    if (ideas.length === 0) return { error: "Die KI hat keine verwertbare Idee geliefert." };

    const idea = ideas[0];
    await prisma.$transaction([
      prisma.blogPost.create({
        data: {
          title: idea.title,
          topic: idea.topic,
          targetKeyword: idea.targetKeyword || gap.query,
          ideaSourceLabel: `Google Search Console: Content-Lücke "${gap.query}" (Position ${gap.avgPosition.toFixed(1)}, ${gap.impressions} Impressionen/28 Tage)`,
        },
      }),
      prisma.seoContentGap.update({ where: { id: gapId }, data: { status: "IDEA_CREATED" } }),
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }

  revalidatePath(SEO_TAB_PATH);
  return undefined;
}

/** Ein-Klick-Idee aus einer DataForSEO-Konkurrenz-Keyword-Lücke (siehe seo-dataforseo.ts) - markiert die Lücke als aufgegriffen. */
export async function createBlogIdeaFromCompetitorGap(formData: FormData): Promise<{ error: string } | undefined> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return { error: "Nur Agentur-Admins können Blogartikel-Ideen generieren." };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." };

  const gapId = String(formData.get("gapId") ?? "");
  const gap = await prisma.seoCompetitorKeywordGap.findUnique({ where: { id: gapId }, include: { competitorDomain: true } });
  if (!gap) return { error: "Konkurrenz-Keyword-Lücke nicht gefunden." };

  const positionNote =
    gap.ourPosition != null
      ? `wir selbst ranken nur auf Position ${gap.ourPosition}`
      : "wir selbst ranken dafür noch gar nicht";
  const input = `Die Konkurrenz-Kanzlei "${gap.competitorDomain.domain}" rankt bei Google für die Suchanfrage "${gap.keyword}" auf Position ${gap.competitorPosition ?? "?"}${gap.searchVolume ? ` (ca. ${gap.searchVolume} Suchanfragen/Monat)` : ""} - ${positionNote}. Entwickle einen Blogartikel, der dieses Thema umfassend und besser als die Konkurrenz beantwortet.`;

  try {
    const ideas = await generateIdeasFromInput(input, 1);
    if (ideas.length === 0) return { error: "Die KI hat keine verwertbare Idee geliefert." };

    const idea = ideas[0];
    await prisma.$transaction([
      prisma.blogPost.create({
        data: {
          title: idea.title,
          topic: idea.topic,
          targetKeyword: idea.targetKeyword || gap.keyword,
          ideaSourceLabel: `DataForSEO: Konkurrenz "${gap.competitorDomain.domain}" rankt für "${gap.keyword}" (Position ${gap.competitorPosition ?? "?"})`,
        },
      }),
      prisma.seoCompetitorKeywordGap.update({ where: { id: gapId }, data: { status: "IDEA_CREATED" } }),
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }

  revalidatePath(SEO_TAB_PATH);
  return undefined;
}

/** Phase 2: schreibt den vollständigen Artikel (Markdown + SEO-Metadaten) zu einer bereits generierten Idee. */
export async function generateBlogPostDraft(formData: FormData): Promise<{ error: string } | { content: string }> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return { error: "Nur Agentur-Admins können Artikeltexte generieren." };
  }
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Beitrag nicht gefunden." };
  if (!post.title || !post.topic) return { error: "Dieser Beitrag hat keine Ideen-Grundlage (Titel/Thema) für die Texterstellung." };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "KI-Funktionen sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." };

  const prompt = `Du schreibst einen vollständigen SEO-Blogartikel für eine Kanzlei-Marketing-Agentur (Zielgruppe: potenzielle Mandanten/Bewerber).

Arbeitstitel: ${post.title}
Worum es gehen soll: ${post.topic}
Haupt-Keyword: ${post.targetKeyword ?? "(kein spezifisches Keyword vorgegeben)"}

Aufgabe: Schreibe einen vollständigen, gut strukturierten Artikel (ca. 800-1200 Wörter) als Markdown:
- Direkte, klare Antwort(en) gleich zu Beginn (wichtig sowohl für Google-Snippets als auch für KI-Antworten/Zitierbarkeit).
- Klare Zwischenüberschriften (##), konkrete Beispiele/Zahlen statt vager Aussagen, wo möglich.
- Ein kurzes Fazit am Ende.
Gib danach, getrennt durch eine Zeile "---META---", noch metaTitle (max. 60 Zeichen) und metaDescription (max. 155 Zeichen) im Format:
metaTitle: ...
metaDescription: ...

${GERMAN_ONLY} Gib NUR den Artikel + den META-Block zurück, ohne weitere Erklärungen davor oder danach.`;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text.trim();
    if (!text) return { error: "Keine Antwort von der KI erhalten." };

    const [content, metaBlock] = text.split("---META---").map((part) => part.trim());
    const metaTitle = metaBlock?.match(/metaTitle:\s*(.+)/i)?.[1]?.trim() ?? post.title;
    const metaDescription = metaBlock?.match(/metaDescription:\s*(.+)/i)?.[1]?.trim() ?? null;
    const slug = post.slug ?? (await uniqueSlug(slugify(post.title)));

    await prisma.blogPost.update({ where: { id: postId }, data: { content, metaTitle, metaDescription, slug } });

    revalidatePath(SEO_TAB_PATH);
    return { content };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen." };
  }
}

/** Manuelle Bearbeitung (Titel/Slug/Meta/Inhalt/Keyword/Bild) im Editor. */
export async function updateBlogPost(formData: FormData): Promise<{ error: string } | undefined> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return { error: "Keine Berechtigung." };
  }

  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Beitrag nicht gefunden." };

  const title = String(formData.get("title") ?? "").trim() || null;
  const metaTitle = String(formData.get("metaTitle") ?? "").trim() || null;
  const metaDescription = String(formData.get("metaDescription") ?? "").trim() || null;
  const targetKeyword = String(formData.get("targetKeyword") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim() || null;
  const featuredImageUrl = String(formData.get("featuredImageUrl") ?? "").trim() || null;
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const slug = slugRaw ? await uniqueSlug(slugify(slugRaw), postId) : post.slug;

  await prisma.blogPost.update({
    where: { id: postId },
    data: { title, metaTitle, metaDescription, targetKeyword, content, featuredImageUrl, slug },
  });

  revalidatePath(SEO_TAB_PATH);
  if (post.slug) revalidatePath(`/blog/${post.slug}`);
  return undefined;
}

const AGENCY_SETTABLE_STATUSES = ["IDEA", "IN_PRODUCTION", "REVIEW", "SCHEDULED"] as const;

/** Spalte wechseln im Board - analog moveSocialPostStatus. */
export async function moveBlogPostStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const postId = String(formData.get("postId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(AGENCY_SETTABLE_STATUSES as readonly string[]).includes(status)) return;

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return;
  if (status === "SCHEDULED" && !post.scheduledAt) throw new Error("Bitte zuerst ein Veröffentlichungsdatum festlegen.");

  await prisma.blogPost.update({ where: { id: postId }, data: { status: status as (typeof AGENCY_SETTABLE_STATUSES)[number] } });
  revalidatePath(SEO_TAB_PATH);
}

/** Setzt/ändert das geplante Veröffentlichungsdatum. */
export async function scheduleBlogPost(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const postId = String(formData.get("postId") ?? "");
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  await prisma.blogPost.update({ where: { id: postId }, data: { scheduledAt } });
  revalidatePath(SEO_TAB_PATH);
}

/** Freigeben (REVIEW -> SCHEDULED/IN_PRODUCTION) - analog approveSocialPost, hier ohne Kunde (jeder AGENCY_ADMIN kann freigeben). */
export async function approveBlogPost(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== "REVIEW") return;

  await prisma.blogPost.update({
    where: { id: postId },
    data: { status: post.scheduledAt ? "SCHEDULED" : "IN_PRODUCTION", reviewFeedback: null },
  });
  revalidatePath(SEO_TAB_PATH);
}

/** Änderung wünschen (REVIEW -> CHANGES_REQUESTED) - analog requestSocialPostChanges. */
export async function requestBlogPostChanges(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return "Keine Berechtigung.";
  }

  const postId = String(formData.get("postId") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!feedback) return "Bitte beschreibe die gewünschte Änderung.";

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return "Beitrag nicht gefunden.";
  if (post.status !== "REVIEW") return "Dieser Beitrag wartet nicht auf Freigabe.";

  await prisma.blogPost.update({ where: { id: postId }, data: { status: "CHANGES_REQUESTED", reviewFeedback: feedback } });
  revalidatePath(SEO_TAB_PATH);
  return undefined;
}

export async function deleteBlogPost(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const postId = String(formData.get("postId") ?? "");
  await prisma.blogPost.delete({ where: { id: postId } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}
