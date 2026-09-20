import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InterestButton } from "./interest-button";

export default async function KundenHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const offers = await prisma.offer.findMany({
    where: { active: true },
    include: { interests: { where: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Angebote</h1>
      <p className="mb-6 text-muted-foreground">Aktuelle Angebote und Upsells von Kanzlei Brands für euch.</p>

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
    </div>
  );
}
