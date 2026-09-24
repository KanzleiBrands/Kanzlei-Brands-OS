import { redirect } from "next/navigation";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readSocialPendingConnection } from "@/lib/meta/social-pending-connection";
import { listAllMetaPages } from "@/lib/meta/graph";
import { MetaSocialConnectWizard } from "./meta-social-connect-wizard";

export default async function ConnectMetaSocialPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") redirect(`/dashboard/clients/${orgId}`);

  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!organization) redirect("/dashboard/clients");

  const pending = await readSocialPendingConnection();
  if (!pending || pending.organizationId !== orgId) {
    redirect(`/dashboard/clients/${orgId}?tab=content&error=meta_session_expired`);
  }

  let pages: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    pages = (await listAllMetaPages(pending.userAccessToken)).map((p) => ({ id: p.id, name: p.name }));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Facebook-Seiten konnten nicht geladen werden.";
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Facebook/Instagram verbinden</h1>
      <p className="mb-6 text-muted-foreground">
        Wähle die Facebook-Seite von &bdquo;{organization.name}&ldquo;, über die Social-Media-Beiträge veröffentlicht
        werden sollen.
      </p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : (
        <MetaSocialConnectWizard organizationId={organization.id} pages={pages} />
      )}
    </div>
  );
}
