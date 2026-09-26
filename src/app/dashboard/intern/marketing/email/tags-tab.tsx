import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTagForm } from "./create-tag-form";
import { TagRow } from "./tag-row";

export async function TagsTab({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [tags, baseUrl] = await Promise.all([
    prisma.marketingTag.findMany({
      where: { organizationId },
      include: {
        listWebhooks: true,
        _count: { select: { subscribers: true, triggeredFunnels: true } },
      },
      orderBy: { name: "asc" },
    }),
    getBaseUrl(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Ein Tag steht z.B. für ein Produkt/eine Ad (&bdquo;A-Mandant&ldquo;, &bdquo;Recruiting&ldquo;). Jeder Tag bekommt einen eigenen Webhook,
        den ihr in eurem Landingpage-/Formular-Tool hinterlegt - beim Absenden landet der Kontakt mit diesem Tag sofort
        in der Liste (kein Double-Opt-in) und startet automatisch jeden Funnel, der auf diesen Tag hört.
      </p>
      {canManage && <CreateTagForm organizationId={organizationId} />}

      <Card>
        <CardHeader>
          <CardTitle>{tags.length} Tag(s)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {tags.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Tags angelegt.</p>}
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={{
                id: tag.id,
                name: tag.name,
                color: tag.color,
                subscriberCount: tag._count.subscribers,
                funnelCount: tag._count.triggeredFunnels,
                webhook: tag.listWebhooks[0] ? { id: tag.listWebhooks[0].id, url: `${baseUrl}/api/webhooks/marketing/${tag.listWebhooks[0].token}` } : null,
              }}
              canManage={canManage}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
