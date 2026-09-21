import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";
import { avatarColorFor, initialsOf } from "@/lib/avatar";
import { contactDisplayName } from "@/lib/contact-display";

type Kind = "hires" | "deals";

export default async function CompletionsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { kind: kindParam } = await searchParams;
  const kind: Kind = kindParam === "deals" ? "deals" : "hires";
  const pipelineKind = kind === "deals" ? "LEADS" : "APPLICANTS";

  const contacts = await prisma.contact.findMany({
    where: {
      pipeline: { kind: pipelineKind, organization: { type: "CLIENT", parentId: session.user.organizationId } },
      stage: { isFinal: true },
    },
    include: {
      pipeline: { select: { name: true, organization: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const eurFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <BackLink href="/dashboard/clients">Zurück zur Kundenübersicht</BackLink>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">{kind === "deals" ? "Abschlüsse" : "Einstellungen"}</h1>

      <div className="flex flex-col gap-2">
        {contacts.map((contact) => {
          const fullName = contactDisplayName(contact);
          return (
            <Link
              key={contact.id}
              href={`/dashboard/contacts/${contact.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: avatarColorFor(fullName) }}
                  >
                    {initialsOf(contact.firstName, contact.lastName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {contact.pipeline.organization.name} · {contact.pipeline.name}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right text-sm">
                  {kind === "deals" ? (
                    <p className="font-medium">
                      {contact.dealVolumeEur ? eurFormatter.format(contact.dealVolumeEur) : "-"}
                    </p>
                  ) : (
                    <p className="font-medium">
                      Start: {contact.startDate ? contact.startDate.toLocaleDateString("de-DE") : "-"}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {contact.updatedAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
        {contacts.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {kind === "deals" ? "Noch keine Abschlüsse." : "Noch keine Einstellungen."}
          </Card>
        )}
      </div>
    </div>
  );
}
