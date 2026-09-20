import { redirect } from "next/navigation";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readPendingConnection } from "@/lib/meta/pending-connection";
import { listMetaPages } from "@/lib/meta/graph";
import { MetaConnectWizard } from "./meta-connect-wizard";

export default async function ConnectMetaPage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;
  const session = await requireSession();

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect("/dashboard/pipelines");
    throw error;
  }
  if (session.user.role !== "AGENCY_ADMIN") redirect(`/dashboard/pipelines/${pipelineId}`);

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { id: true, name: true } });
  if (!pipeline) redirect("/dashboard/pipelines");

  const pending = await readPendingConnection();
  if (!pending || pending.pipelineId !== pipelineId) {
    redirect(`/dashboard/pipelines/${pipelineId}?tab=sources&error=meta_session_expired`);
  }

  let pages: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    pages = (await listMetaPages(pending.userAccessToken)).map((p) => ({ id: p.id, name: p.name }));
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Facebook-Seiten konnten nicht geladen werden.";
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Facebook/Instagram verbinden</h1>
      <p className="mb-6 text-muted-foreground">
        Wähle die Facebook-Seite und das Lead-Formular, dessen Antworten in &bdquo;{pipeline.name}&ldquo; landen
        sollen.
      </p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : (
        <MetaConnectWizard pipelineId={pipeline.id} pages={pages} />
      )}
    </div>
  );
}
