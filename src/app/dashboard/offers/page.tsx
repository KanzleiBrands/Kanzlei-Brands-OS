import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewOfferForm } from "./new-offer-form";
import { OfferActiveToggle } from "./offer-active-toggle";

export default async function OffersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const offers = await prisma.offer.findMany({
    include: { interests: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Angebote</h1>
        <NewOfferForm />
      </div>
      <p className="mb-6 text-muted-foreground">
        Diese Angebote werden identisch bei allen Kunden im Bereich &bdquo;Angebote&ldquo; angezeigt.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Alle Angebote</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interesse bekundet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title}</TableCell>
                  <TableCell>
                    <OfferActiveToggle offerId={offer.id} active={offer.active} />
                  </TableCell>
                  <TableCell>
                    {offer.interests.length === 0
                      ? "Noch niemand"
                      : offer.interests.map((i) => i.user.name).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
              {offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
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
