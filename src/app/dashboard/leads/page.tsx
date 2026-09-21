import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { accessiblePipelineIds } from "@/lib/access";
import { CrossPipelineContactsTable } from "./cross-pipeline-contacts-table";

const TITLES: Record<string, string> = {
  LEADS: "Mandatsanfragen",
  APPLICANTS: "Bewerbungen",
};

export default async function CrossPipelineLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const { kind: kindParam } = await searchParams;
  const kind = kindParam === "APPLICANTS" ? "APPLICANTS" : "LEADS";

  const accessible = await accessiblePipelineIds(session, session.user.organizationId);
  const pipelineFilter: Prisma.PipelineWhereInput = {
    organizationId: session.user.organizationId,
    kind,
    ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
  };

  // Mit genau einer Kampagne dieses Typs (der Normalfall) ist diese
  // schreibgeschützte Übersichtstabelle nicht der eigentliche Arbeitsort -
  // das ist das Kanban-Board der Kampagne selbst (Drag&Drop zwischen
  // Stufen, Schnellaktionen). Erst bei mehreren Kampagnen desselben Typs
  // ergibt eine kampagnenübergreifende Übersicht wirklich Sinn.
  const pipelineIds = await prisma.pipeline.findMany({ where: pipelineFilter, select: { id: true } });
  if (pipelineIds.length === 1) {
    redirect(`/dashboard/pipelines/${pipelineIds[0].id}`);
  }

  const pipelines = await prisma.pipeline.findMany({
    where: pipelineFilter,
    include: {
      contacts: {
        orderBy: { createdAt: "desc" },
        include: { stage: true },
      },
    },
  });

  const rows = pipelines.flatMap((pipeline) =>
    pipeline.contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      source: contact.source,
      rating: contact.rating,
      createdAt: contact.createdAt.toISOString(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      stageName: contact.stage.name,
      stageColor: contact.stage.color,
    })),
  );

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">
        {TITLES[kind]} - {session.user.name}
      </h1>
      <p className="mb-6 text-muted-foreground">
        Alle {kind === "APPLICANTS" ? "Bewerber" : "Anfragen"} aus allen deinen{" "}
        {kind === "APPLICANTS" ? "Recruiting" : "Mandatsakquise"}-Kampagnen an einem Ort.
      </p>

      <CrossPipelineContactsTable rows={rows} />
    </div>
  );
}
