import { redirect } from "next/navigation";
import { requireSession } from "@/lib/access";
import { readWhatsAppPendingConnection } from "@/lib/meta/whatsapp-pending-connection";
import { listAllWhatsAppBusinessAccounts } from "@/lib/meta/graph";
import { WhatsAppConnectWizard } from "./whatsapp-connect-wizard";

export default async function ConnectWhatsAppPage() {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard/intern/marketing/whatsapp");

  const pending = await readWhatsAppPendingConnection();
  if (!pending || pending.organizationId !== session.user.organizationId) {
    redirect("/dashboard/intern/marketing/whatsapp?error=meta_session_expired");
  }

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
        Wähle das WhatsApp-Business-Konto und die Telefonnummer von Kanzlei Brands, über die Vorlagen-Nachrichten
        verschickt werden sollen.
      </p>

      {loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : (
        <WhatsAppConnectWizard businessAccounts={businessAccounts} />
      )}
    </div>
  );
}
