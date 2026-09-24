import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOffersSectionEnabled } from "@/lib/actions/offers";
import { OfferFormDialog } from "./offer-form-dialog";
import { OfferActiveToggle } from "./offer-active-toggle";
import { DeleteOfferButton } from "./delete-offer-button";
import { OffersSectionToggle } from "./offers-section-toggle";

export default async function OffersPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const [offers, offersSectionEnabled] = await Promise.all([
    prisma.offer.findMany({
      include: { interests: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getOffersSectionEnabled(),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Angebote</h1>
        <OfferFormDialog />
      </div>
      <p className="mb-6 text-muted-foreground">
        Diese Angebote werden Kunden im Kunden-Hub angezeigt - außer bei Kunden, die das passende Produkt-Tag
        bereits unter &bdquo;Bereits gebuchte Produkte&ldquo; (Kundeneinstellungen) hinterlegt haben.
      </p>

      <div className="mb-6">
        <OffersSectionToggle enabled={offersSectionEnabled} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Angebote</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Angebot</TableHead>
                <TableHead>Produkt-Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interesse bekundet</TableHead>
                <TableHead className="w-20 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {offer.imageUrl ? (
                        <div className="h-8 w-14 shrink-0 overflow-hidden rounded-md bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={offer.imageUrl} alt="" className="size-full object-contain" />
                        </div>
                      ) : null}
                      <div className="flex flex-col">
                        <span>{offer.title}</span>
                        {offer.badge && (
                          <Badge variant="outline" className="mt-0.5 w-fit text-[0.65rem]">
                            {offer.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{offer.productTag ?? "-"}</TableCell>
                  <TableCell>
                    <OfferActiveToggle offerId={offer.id} active={offer.active} />
                  </TableCell>
                  <TableCell>
                    {offer.interests.length === 0
                      ? "Noch niemand"
                      : offer.interests.map((i) => i.user.name).join(", ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <OfferFormDialog
                        offer={{
                          id: offer.id,
                          title: offer.title,
                          description: offer.description,
                          imageUrl: offer.imageUrl,
                          badge: offer.badge,
                          ctaLabel: offer.ctaLabel,
                          productTag: offer.productTag,
                          highlights: offer.highlights,
                          galleryUrls: offer.galleryUrls,
                        }}
                      />
                      <DeleteOfferButton offerId={offer.id} offerTitle={offer.title} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Noch keine Angebote.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
