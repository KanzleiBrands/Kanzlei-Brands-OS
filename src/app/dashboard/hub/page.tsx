import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CampaignRequestCard } from "../pipelines/campaign-request-card";
import { ContactCard } from "./contact-card";
import { ResourceLinksCard } from "./resource-links-card";
import { InterestButton } from "./interest-button";

const ACCOUNT_MANAGER_EMAIL = "support@kanzlei-brands.de";
const BACKOFFICE_EMAIL = "buchhaltung@kanzlei-brands.de";

// Die Angebote-Sektion im Kunden-Hub ist noch nicht fertig entwickelt und
// daher für Kunden vorerst ausgeblendet. Auf true setzen, um sie wieder
// einzublenden, sobald sie fertig ist. Die Angebote-Verwaltung für
// Agentur-Admins (/dashboard/offers) ist davon unabhängig und bleibt aktiv.
const OFFERS_SECTION_ENABLED = false;

export default async function KundenHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const [organization, agency] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        accountManager: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } },
      },
    }),
    // Die Buchhaltung/Backoffice ist portalweit einheitlich (es gibt nur
    // eine für alle Kunden) und wird daher auf der Agentur-Organisation
    // selbst gepflegt, nicht pro Kunde - siehe updatePortalBackofficeContact.
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

  const offers = OFFERS_SECTION_ENABLED
    ? await prisma.offer.findMany({
        where: {
          active: true,
          OR: [{ productTag: null }, { productTag: { notIn: organization.bookedProductTags } }],
        },
        include: { interests: { where: { userId: session.user.id } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Kunden-Hub</h1>
      <p className="mb-6 text-muted-foreground">
        {OFFERS_SECTION_ENABLED
          ? "Deine Ansprechpartner, Ressourcen und Angebote von Kanzlei Brands an einem Ort."
          : "Deine Ansprechpartner und Ressourcen von Kanzlei Brands an einem Ort."}
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ContactCard
          title="Account Manager"
          description="Fragen zu Kampagnen, Strategie oder neuen Themen?"
          contact={organization.accountManager}
          teamEmail={ACCOUNT_MANAGER_EMAIL}
        />
        <ContactCard
          title="Buchhaltung / Backoffice"
          description="Fragen zu Rechnungen oder Vertragswesen?"
          contact={agency?.backofficeContact ?? null}
          teamEmail={BACKOFFICE_EMAIL}
        />
      </div>

      <div className="mb-8">
        <ResourceLinksCard
          driveFolderUrl={organization.driveFolderUrl}
          landingPageUrl={organization.landingPageUrl}
          metaAdLibraryUrl={organization.metaAdLibraryUrl}
          linkedInAdLibraryUrl={organization.linkedInAdLibraryUrl}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Neue Kampagne einreichen</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {OFFERS_SECTION_ENABLED && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Angebote</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Card key={offer.id}>
                {offer.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={offer.imageUrl} alt={offer.title} className="h-32 w-full rounded-t-md object-cover" />
                )}
                <CardHeader>
                  <CardTitle>{offer.title}</CardTitle>
                  {offer.description && <CardDescription>{offer.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <InterestButton offerId={offer.id} ctaLabel={offer.ctaLabel} already={offer.interests.length > 0} />
                </CardContent>
              </Card>
            ))}
            {offers.length === 0 && <p className="text-muted-foreground">Aktuell keine Angebote verfügbar.</p>}
          </div>
        </>
      )}
    </div>
  );
}
