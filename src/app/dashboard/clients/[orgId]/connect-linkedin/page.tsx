import { redirect } from "next/navigation";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readLinkedInPendingConnection } from "@/lib/linkedin/pending-connection";
import { listLinkedInOrganizations } from "@/lib/linkedin/client";
import { LinkedInConnectWizard } from "./linkedin-connect-wizard";

export default async function ConnectLinkedInPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") redirect(`/dashboard/clients/${orgId}`);

  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!organization) redirect("/dashboard/clients");

  const pending = await readLinkedInPendingConnection();
  if (!pending || pending.organizationId !== orgId) {
    redirect(`/dashboard/clients/${orgId}?tab=content&error=linkedin_session_expired`);
  }

  let organizations: { urn: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    organizations = (await listLinkedInOrganizations(pending.userAccessToken)).map((o) => ({
      urn: o.urn,
      name: o.name,
    }));
  } catch (error) {
    loadError =
      error instanceof Error
        ? `${error.message} (LinkedIn-Posting braucht eine Marketing-Developer-Platform-Partnerschaft - falls die noch nicht genehmigt ist, schlägt das hier fehl.)`
        : "LinkedIn-Organisationen konnten nicht geladen werden.";
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">LinkedIn verbinden</h1>
      <p className="mb-6 text-muted-foreground">
        Wähle die LinkedIn-Unternehmensseite von &bdquo;{organization.name}&ldquo;, über die Social-Media-Beiträge
        veröffentlicht werden sollen.
      </p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : (
        <LinkedInConnectWizard organizationId={organization.id} organizations={organizations} />
      )}
    </div>
  );
}
