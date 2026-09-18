import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { CONTACT_SOURCE_LABELS } from "@/lib/contact-source-labels";
import { objectsToCsv } from "@/lib/csv";

const HEADERS = ["Vorname", "Nachname", "E-Mail", "Telefon", "Ort", "Status", "Quelle", "Bewertung", "Eingang"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
    throw error;
  }

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: { contacts: { orderBy: { createdAt: "desc" } } },
      },
    },
  });
  if (!pipeline) return NextResponse.json({ error: "Pipeline nicht gefunden" }, { status: 404 });

  const rows = pipeline.stages.flatMap((stage) =>
    stage.contacts.map((contact) => ({
      Vorname: contact.firstName ?? "",
      Nachname: contact.lastName ?? "",
      "E-Mail": contact.email ?? "",
      Telefon: contact.phone ?? "",
      Ort: contact.location ?? "",
      Status: stage.name,
      Quelle: CONTACT_SOURCE_LABELS[contact.source] ?? contact.source,
      Bewertung: contact.rating ? String(contact.rating) : "",
      Eingang: contact.createdAt.toLocaleDateString("de-DE"),
    })),
  );

  const csv = objectsToCsv(rows, HEADERS);
  const filename = `${pipeline.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-kontakte.csv`;

  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
