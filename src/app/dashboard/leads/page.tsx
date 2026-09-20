import { redirect } from "next/navigation";
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

  const pipelines = await prisma.pipeline.findMany({
    where: {
      organizationId: session.user.organizationId,
      kind,
      ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
    },
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
      <h1 className="mb-2 text-2xl font-semibold">{TITLES[kind]}</h1>
      <p className="mb-6 text-muted-foreground">
        Alle {kind === "APPLICANTS" ? "Bewerber" : "Anfragen"} aus allen deinen{" "}
        {kind === "APPLICANTS" ? "Recruiting" : "Mandatsakquise"}-Kampagnen an einem Ort.
      </p>

      <CrossPipelineContactsTable rows={rows} />
    </div>
  );
}
