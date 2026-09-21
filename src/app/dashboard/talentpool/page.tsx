import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { avatarColorFor, initialsOf } from "@/lib/avatar";
import { contactDisplayName } from "@/lib/contact-display";
import { NewTalentPoolForm } from "./new-talent-pool-form";
import { RenamePoolButton } from "./rename-pool-button";

export default async function TalentPoolPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const pools = await prisma.talentPool.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
    include: {
      contacts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          talentPoolNote: true,
          pipeline: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Talentpool</h1>
          <p className="text-muted-foreground">
            Kandidaten, die aktuell nicht passen, aber grundsätzlich interessant sind - gruppiert in eigenen,
            benannten Pools statt nur an eine einzelne Kampagne gebunden zu sein.
          </p>
        </div>
        <NewTalentPoolForm />
      </div>

      {pools.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Pools angelegt. Lege oben einen an, oder füge einen Bewerber direkt über seine Detailseite zum
          Talentpool hinzu.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {pools.map((pool) => (
          <Card key={pool.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  {pool.name}
                  <span className="text-sm font-normal text-muted-foreground">{pool.contacts.length}</span>
                </CardTitle>
                <RenamePoolButton poolId={pool.id} currentName={pool.name} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {pool.contacts.map((contact) => {
                const fullName = contactDisplayName(contact);
                return (
                  <Link
                    key={contact.id}
                    href={`/dashboard/contacts/${contact.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:border-primary"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: avatarColorFor(fullName) }}
                      >
                        {initialsOf(contact.firstName, contact.lastName)}
                      </span>
                      <div className="overflow-hidden">
                        <p className="truncate font-medium">{fullName}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {contact.pipeline.name}
                          {contact.talentPoolNote && ` · ${contact.talentPoolNote}`}
                        </p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-sm text-muted-foreground">
                      {contact.email ?? contact.phone ?? ""}
                    </span>
                  </Link>
                );
              })}
              {pool.contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Kandidaten in diesem Pool.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
