import { redirect } from "next/navigation";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readWhatsAppPendingConnection } from "@/lib/meta/whatsapp-pending-connection";
import { listAllWhatsAppBusinessAccounts } from "@/lib/meta/graph";
import { WhatsAppConnectWizard } from "./whatsapp-connect-wizard";

/**
 * Letzter Schritt des WhatsApp-Verbinden-Flows (WABA + Telefonnummer wählen) -
 * org-agnostisch: die Ziel-Organisation (eigene Agentur-Org fürs interne
 * Marketing-Center, oder ein Kunde fürs Kampagnen-Reiter) steckt im Pending-
 * Connection-Cookie, nicht in der URL. Nach "Verbinden" geht's zurück zur
 * passenden Stelle: Kampagnen-Reiter bei pipelineId, sonst interne Übersicht.
 */
export default async function ConnectWhatsAppPage() {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard/intern/marketing/whatsapp");

  const pending = await readWhatsAppPendingConnection();
  if (!pending) {
    redirect("/dashboard/intern/marketing/whatsapp?error=meta_session_expired");
  }

  const redirectTo = pending.pipelineId
    ? `/dashboard/pipelines/${pending.pipelineId}?tab=whatsapp-marketing&whatsappConnected=1`
    : "/dashboard/intern/marketing/whatsapp?connected=1";

  const organization = await prisma.organization.findUnique({ where: { id: pending.organizationId }, select: { name: true } });

  let businessAccounts: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    businessAccounts = await listAllWhatsAppBusinessAccounts(pending.userAccessToken);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "WhatsApp-Business-Konten konnten nicht geladen werden.";
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">WhatsApp verbinden</h1>
      <p className="mb-6 text-muted-foreground">
        Wähle das WhatsApp-Business-Konto und die Telefonnummer von &bdquo;{organization?.name ?? "diesem Kunden"}&ldquo;,
        über die Vorlagen-Nachrichten verschickt werden sollen.
      </p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : (
        <WhatsAppConnectWizard businessAccounts={businessAccounts} redirectTo={redirectTo} />
      )}
    </div>
  );
}
