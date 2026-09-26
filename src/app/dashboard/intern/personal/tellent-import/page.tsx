import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TellentImportForm } from "./tellent-import-form";

/**
 * Einmalige Migration: Personal-Stammdaten aus Tellent HR übernehmen.
 * Läuft im App-Server, damit kein externer Zugriff auf die Produktions-DB
 * nötig ist. Nach der Migration kann diese Seite wieder entfernt werden.
 */
export default async function TellentImportPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard/intern/personal");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Tellent-HR-Datenübernahme (einmalig)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Ordnet Tellent-Mitarbeiter per E-Mail unseren Accounts zu und übernimmt Position, Standort,
            Geburtstag, Eintritts-/Austrittsdatum und Manager. Erst &quot;Vorschau&quot; prüfen, dann mit
            &quot;Übernehmen&quot; anwenden. Der API-Key wird nicht gespeichert.
          </p>
          <TellentImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
