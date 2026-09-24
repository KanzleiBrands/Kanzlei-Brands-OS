import { redirect } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getOffersSectionEnabled } from "@/lib/actions/offers";
import { CampaignRequestCard } from "../pipelines/campaign-request-card";
import { ContactCard } from "./contact-card";
import { ResourceLinksCard } from "./resource-links-card";
import { InterestButton } from "./interest-button";

const ACCOUNT_MANAGER_EMAIL = "support@kanzlei-brands.de";
const BACKOFFICE_EMAIL = "buchhaltung@kanzlei-brands.de";

export default async function KundenHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const offersSectionEnabled = await getOffersSectionEnabled();

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

  const offers = offersSectionEnabled
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
      <h1 className="mb-2 text-2xl font-semibold">Kunden-Hub - {session.user.name}</h1>
      <p className="mb-6 text-muted-foreground">
        {offersSectionEnabled
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

      {offersSectionEnabled && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Angebote</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Card key={offer.id} className="flex flex-col overflow-hidden py-0">
                {offer.imageUrl && (
                  <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
                    {offer.badge && (
                      <Badge className="absolute top-2 left-2 z-10">{offer.badge}</Badge>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={offer.imageUrl} alt={offer.title} className="size-full object-contain" />
                  </div>
                )}
                {offer.galleryUrls.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto p-2 pb-0">
                    {offer.galleryUrls.map((url) => (
                      <div
                        key={url}
                        className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black"
                        style={{ aspectRatio: "16 / 9" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="size-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}
                <CardHeader className="pt-4">
                  {!offer.imageUrl && offer.badge && (
                    <Badge className="mb-1 w-fit">{offer.badge}</Badge>
                  )}
                  <CardTitle>{offer.title}</CardTitle>
                  {offer.description && <CardDescription>{offer.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pb-4">
                  {offer.highlights.length > 0 && (
                    <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                      {offer.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
