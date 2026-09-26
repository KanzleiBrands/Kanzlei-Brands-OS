import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSubscriberDialog } from "./add-subscriber-dialog";
import { SubscriberRow } from "./subscriber-row";

export async function ContactsTab({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [subscribers, tags] = await Promise.all([
    prisma.marketingSubscriber.findMany({
      where: { organizationId },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.marketingTag.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Eure E-Mail-Liste - Interessent:innen, die sich über eine Ad/Landingpage eingetragen haben. Kein Double-Opt-in,
          direkt aktiv.
        </p>
        {canManage && (
          <AddSubscriberDialog
            organizationId={organizationId}
            tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{subscribers.length} Kontakt(e)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {subscribers.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Kontakte - über einen Tag-Webhook oder manuell hinzufügen.</p>
          )}
          {subscribers.map((subscriber) => (
            <SubscriberRow
              key={subscriber.id}
              subscriber={{
                id: subscriber.id,
                email: subscriber.email,
                firstName: subscriber.firstName,
                lastName: subscriber.lastName,
                status: subscriber.status,
                suppressedReason: subscriber.suppressedReason,
                tags: subscriber.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
              }}
              allTags={tags.map((t) => ({ id: t.id, name: t.name }))}
              canManage={canManage}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
