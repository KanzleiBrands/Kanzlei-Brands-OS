import { redirect } from "next/navigation";
import { Fragment } from "react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { CampaignRequestCard } from "../pipelines/campaign-request-card";
import { ContactCard } from "./contact-card";
import { ResourceLinksCard } from "./resource-links-card";
import { OfficeHoursCard } from "./office-hours-card";
import { getPageLayout } from "@/lib/page-layout";

const ACCOUNT_MANAGER_EMAIL = "support@kanzlei-brands.de";
const BACKOFFICE_EMAIL = "buchhaltung@kanzlei-brands.de";

export default async function KundenHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const [organization, agency] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        accountManager: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } },
        backofficeContact: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } },
      },
    }),
    // Fallback, falls dieser Kunde keinen eigenen Backoffice-Ansprechpartner
    // hat (siehe Organization.backofficeContactId, gepflegt pro Kunde in
    // updateOrganizationIntakeSettings): der portalweite Standardkontakt auf
    // der Agentur-Organisation selbst, siehe updatePortalBackofficeContact.
    prisma.organization.findFirst({
      where: { type: "AGENCY" },
      select: { backofficeContact: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } } },
    }),
  ]);
  if (!organization) redirect("/login");

  const allOrgPipelines = await prisma.pipeline.findMany({
    where: { organizationId: session.user.organizationId },
    select: { kind: true },
  });
  const leadsUsed = allOrgPipelines.filter((p) => p.kind === "LEADS").length;
  const applicantsUsed = allOrgPipelines.filter((p) => p.kind === "APPLICANTS").length;
  const canRequest = session.user.role === "CLIENT_ADMIN";

  const layout = await getPageLayout("HUB");

  const sections: Record<string, React.ReactNode> = {
    contact_cards: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ContactCard
          title="Account Manager"
          description="Fragen zu Kampagnen, Strategie oder neuen Themen?"
          contact={organization.accountManager}
          teamEmail={ACCOUNT_MANAGER_EMAIL}
        />
        <ContactCard
          title="Buchhaltung / Backoffice"
          description="Fragen zu Rechnungen oder Vertragswesen?"
          contact={organization.backofficeContact ?? agency?.backofficeContact ?? null}
          teamEmail={BACKOFFICE_EMAIL}
        />
        <OfficeHoursCard />
      </div>
    ),

    resources: (
      <ResourceLinksCard
        driveFolderUrl={organization.driveFolderUrl}
        landingPageUrl={organization.landingPageUrl}
        metaAdLibraryUrl={organization.metaAdLibraryUrl}
        linkedInAdLibraryUrl={organization.linkedInAdLibraryUrl}
      />
    ),

    campaign_requests: (
      <div>
        <h2 className="mb-3 text-lg font-semibold">Neue Kampagne einreichen</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampaignRequestCard
            organizationId={session.user.organizationId}
            kind="APPLICANTS"
            used={applicantsUsed}
            quota={organization.applicantsQuota}
            formUrl={organization.applicantsFormUrl}
            canRequest={canRequest}
          />
          <CampaignRequestCard
            organizationId={session.user.organizationId}
            kind="LEADS"
            used={leadsUsed}
            quota={organization.leadsQuota}
            formUrl={organization.leadsFormUrl}
            canRequest={canRequest}
          />
        </div>
      </div>
    ),
  };

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Kunden-Hub - {session.user.name}</h1>
      <p className="mb-6 text-muted-foreground">Deine Ansprechpartner und Ressourcen von Kanzlei Brands an einem Ort.</p>

      <div className="flex flex-col gap-8">
        {layout
          .filter((block) => block.enabled)
          .map((block) => <Fragment key={block.key}>{sections[block.key]}</Fragment>)}
      </div>
    </div>
  );
}
