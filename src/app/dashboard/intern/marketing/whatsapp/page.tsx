import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/auth-encryption";
import { listWhatsAppTemplates } from "@/lib/meta/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppChannelList } from "./whatsapp-channel-list";
import { WhatsAppBroadcastForm } from "./whatsapp-broadcast-form";

export default async function InternalWhatsAppMarketingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;
  const isAdmin = session.user.role === "AGENCY_ADMIN";

  const channels = await prisma.whatsAppChannel.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });

  const [templatesByChannel, recentSends] = await Promise.all([
    Promise.all(
      channels.map(async (channel) => {
        try {
          const templates = await listWhatsAppTemplates(channel.businessAccountId, decryptToken(channel.accessTokenEnc));
          return { channelId: channel.id, templates: templates.filter((t) => t.status === "APPROVED") };
        } catch {
          return { channelId: channel.id, templates: [] };
        }
      }),
    ),
    prisma.whatsAppTemplateSend.findMany({
      where: { channel: { organizationId } },
      include: { sentBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const templatesByChannelId = new Map(templatesByChannel.map((t) => [t.channelId, t.templates]));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp-Kanal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nur an ausdrücklich einwilligende Empfänger:innen senden (Opt-in) - Meta genehmigt nur vorab eingereichte
            Vorlagen für Marketing-Nachrichten außerhalb des 24h-Servicefensters.
          </p>
          <WhatsAppChannelList channels={channels} canManage={isAdmin} />
        </CardContent>
      </Card>

      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vorlage verschicken</CardTitle>
          </CardHeader>
          <CardContent>
            <WhatsAppBroadcastForm
              channels={channels.map((c) => ({
                id: c.id,
                displayName: `${c.displayName} (${c.displayPhoneNumber})`,
                templates: templatesByChannelId.get(c.id) ?? [],
              }))}
            />
          </CardContent>
        </Card>
      )}

      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Versandhistorie</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentSends.length === 0 && <p className="text-sm text-muted-foreground">Noch nichts verschickt.</p>}
            {recentSends.map((send) => (
              <div key={send.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {send.templateName} → {send.recipientPhone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {send.createdAt.toLocaleString("de-DE")} · {send.sentBy?.name ?? "—"}
                    {send.error ? ` · ${send.error}` : ""}
                  </p>
                </div>
                <span className={send.status === "SENT" ? "text-emerald-600" : "text-destructive"}>
                  {send.status === "SENT" ? "Gesendet" : "Fehlgeschlagen"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
