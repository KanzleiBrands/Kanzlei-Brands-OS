import { redirect } from "next/navigation";
import { GiftIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { getPartnerPointsBalance } from "@/lib/actions/partner-program";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactCard } from "../hub/contact-card";
import { PartnerActionFormDialog } from "./partner-action-form-dialog";
import { PartnerRewardFormDialog } from "./partner-reward-form-dialog";
import { PartnerActiveToggle, PartnerMoveButtons, PartnerDeleteButton } from "./partner-row-controls";
import { RedeemRewardButton } from "./redeem-reward-button";

const ACCOUNT_MANAGER_EMAIL = "support@kanzlei-brands.de";

export default async function PartnerProgramPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  if (session.user.role === "AGENCY_ADMIN") {
    const [actions, rewards] = await Promise.all([
      prisma.partnerAction.findMany({ orderBy: { order: "asc" } }),
      prisma.partnerReward.findMany({ orderBy: { order: "asc" } }),
    ]);

    return (
      <div className="p-4 sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold">Partnerprogramm</h1>
        <p className="mb-6 text-muted-foreground">
          Katalog fürs Partnerprogramm - gilt für alle Kunden. Punkte gutschreiben oder Kundenstände einsehen geht
          über den Reiter &bdquo;Partnerprogramm&ldquo; auf der jeweiligen Kundenseite.
        </p>

        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Punkte sammeln</h2>
            <PartnerActionFormDialog />
          </div>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Punkte</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action, index) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <PartnerMoveButtons kind="action" id={action.id} isFirst={index === 0} isLast={index === actions.length - 1} />
                      </TableCell>
                      <TableCell className="font-medium">{action.title}</TableCell>
                      <TableCell>{action.points}</TableCell>
                      <TableCell>
                        <PartnerActiveToggle kind="action" id={action.id} active={action.active} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <PartnerActionFormDialog action={action} />
                          <PartnerDeleteButton kind="action" id={action.id} title={action.title} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {actions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Noch keine Aktionen.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Punkte einlösen</h2>
            <PartnerRewardFormDialog />
          </div>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Prämie</TableHead>
                    <TableHead>Kosten</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward, index) => (
                    <TableRow key={reward.id}>
                      <TableCell>
                        <PartnerMoveButtons kind="reward" id={reward.id} isFirst={index === 0} isLast={index === rewards.length - 1} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {reward.imageUrl && (
                            <div className="h-8 w-14 shrink-0 overflow-hidden rounded-md bg-black">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={reward.imageUrl} alt="" className="size-full object-cover" />
                            </div>
                          )}
                          {reward.title}
                        </div>
                      </TableCell>
                      <TableCell>{reward.pointsCost} Punkte</TableCell>
                      <TableCell>
                        <PartnerActiveToggle kind="reward" id={reward.id} active={reward.active} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <PartnerRewardFormDialog reward={reward} />
                          <PartnerDeleteButton kind="reward" id={reward.id} title={reward.title} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rewards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Noch keine Prämien.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Client-facing view -------------------------------------------------
  const [organization, balance, actions, rewards] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: { accountManager: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } } },
    }),
    getPartnerPointsBalance(session.user.organizationId),
    prisma.partnerAction.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.partnerReward.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);
  if (!organization) redirect("/login");

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Partnerprogramm</h1>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>So funktioniert&apos;s</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Führen Sie eine oder mehrere der unten aufgelisteten Aktionen durch. Im Hintergrund notieren wir
              automatisch Ihre gesammelten Prämien-Punkte.
            </p>
            <p>
              Abhängig davon, wie viele Prämien-Punkte Sie sammeln, können Sie diese gegen eine der aufgelisteten
              Dienstleistungspakete einlösen.
            </p>
          </CardContent>
        </Card>
        <Card className="sm:w-72">
          <CardHeader>
            <CardTitle>Aktueller Punktestand</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-1 text-sm text-muted-foreground">Ihre aktuelle Anzahl an verfügbaren Prämien-Punkten</p>
            <p className="text-3xl font-semibold">{balance}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Prämien sammeln:</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Card key={action.id}>
            <CardContent className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit gap-1">
                <GiftIcon className="size-3" />
                Für {action.points} Prämien-Punkt{action.points === 1 ? "" : "e"}
              </Badge>
              <p className="font-medium">{action.title}</p>
              {action.description && <p className="text-sm text-muted-foreground">{action.description}</p>}
              {action.ctaUrl && (
                <a
                  href={action.ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex w-fit items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  {action.ctaLabel}
                </a>
              )}
            </CardContent>
          </Card>
        ))}
        {actions.length === 0 && <p className="text-sm text-muted-foreground">Aktuell keine Aktionen verfügbar.</p>}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Prämien-Punkte einlösen:</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rewards.map((reward) => {
          const missingPoints = Math.max(0, reward.pointsCost - balance);
          return (
            <Card key={reward.id} className="flex flex-col overflow-hidden py-0">
              {reward.imageUrl && (
                <div className="aspect-video w-full bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reward.imageUrl} alt="" className="size-full object-cover" />
                </div>
              )}
              <CardContent className="flex flex-1 flex-col gap-2 py-4">
                <Badge variant="outline" className="w-fit gap-1">
                  <GiftIcon className="size-3" />
                  für {reward.pointsCost} Prämien-Punkte
                </Badge>
                <p className="font-medium">{reward.title}</p>
                {reward.description && <p className="flex-1 text-sm text-muted-foreground">{reward.description}</p>}
                <RedeemRewardButton
                  rewardId={reward.id}
                  ctaLabel={reward.ctaLabel}
                  affordable={missingPoints === 0}
                  missingPoints={missingPoints}
                />
              </CardContent>
            </Card>
          );
        })}
        {rewards.length === 0 && <p className="text-sm text-muted-foreground">Aktuell keine Prämien verfügbar.</p>}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Ihr Ansprechpartner bei Rückfragen:</h2>
      <ContactCard
        title="Ansprechpartner"
        description="Fragen zum Partnerprogramm? Meldet euch gerne bei uns."
        contact={organization.accountManager}
        teamEmail={ACCOUNT_MANAGER_EMAIL}
      />
    </div>
  );
}
