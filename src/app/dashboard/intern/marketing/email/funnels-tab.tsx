import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFunnelForm } from "./create-funnel-form";
import { FunnelsList } from "./funnels-list";

export async function FunnelsTab({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [funnels, tags, senderAccounts, subscribers] = await Promise.all([
    prisma.marketingFunnel.findMany({
      where: { organizationId },
      include: {
        triggerTag: { select: { id: true, name: true } },
        steps: {
          orderBy: { order: "asc" },
          include: { sends: { select: { openedAt: true, clickedAt: true } } },
        },
        enrollments: { include: { subscriber: { select: { email: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.marketingTag.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.emailAccount.findMany({
      where: { user: { organizationId } },
      include: { user: { select: { name: true } } },
      orderBy: { email: "asc" },
    }),
    prisma.marketingSubscriber.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const funnelData = funnels.map((funnel) => ({
    id: funnel.id,
    name: funnel.name,
    active: funnel.active,
    triggerTagId: funnel.triggerTagId,
    triggerTagName: funnel.triggerTag?.name ?? null,
    senderAccountId: funnel.senderAccountId,
    steps: funnel.steps.map((step) => ({
      id: step.id,
      order: step.order,
      delayDays: step.delayDays,
      subject: step.subject,
      preheader: step.preheader,
      bodyText: step.bodyText,
      ctaLabel: step.ctaLabel,
      ctaUrl: step.ctaUrl,
      sentCount: step.sends.length,
      openCount: step.sends.filter((s) => s.openedAt).length,
      clickCount: step.sends.filter((s) => s.clickedAt).length,
    })),
    enrollments: funnel.enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      currentStepOrder: e.currentStepOrder,
      subscriberName: [e.subscriber.firstName, e.subscriber.lastName].filter(Boolean).join(" ") || e.subscriber.email,
    })),
    enrollableSubscribers: subscribers
      .filter((s) => !funnel.enrollments.some((e) => e.subscriberId === s.id))
      .map((s) => ({ id: s.id, name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Ein Funnel wird durch einen Tag ausgelöst - sobald ein Kontakt diesen Tag bekommt, startet die Mail-Sequenz
        automatisch. Ohne Trigger-Tag lässt sich ein Funnel nur manuell befüllen.
      </p>
      {canManage && <CreateFunnelForm organizationId={organizationId} tags={tags} />}

      {funnelData.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noch kein Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Legt oben einen Funnel an, um Kontakte automatisiert per E-Mail zu begleiten.</p>
          </CardContent>
        </Card>
      ) : (
        <FunnelsList funnels={funnelData} tags={tags} senderAccounts={senderAccounts.map((a) => ({ id: a.id, email: a.email, userName: a.user.name ?? a.email }))} canManage={canManage} />
      )}
    </div>
  );
}
