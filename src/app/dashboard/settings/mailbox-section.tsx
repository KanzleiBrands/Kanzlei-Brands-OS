import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DisconnectButton } from "../mailbox/disconnect-button";

type EmailAccount = { id: string; email: string; provider: string };

export function MailboxSection({
  accounts,
  connected,
  error,
}: {
  accounts: EmailAccount[];
  connected?: string;
  error?: string;
}) {
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID;

  return (
    <div className="flex flex-col gap-6">
      {connected && <p className="text-sm text-green-600">Postfach erfolgreich verbunden.</p>}
      {error && <p className="text-sm text-destructive">Verbindung fehlgeschlagen ({error}).</p>}

      <Card>
        <CardHeader>
          <CardTitle>Verbundene Postfächer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{account.email}</p>
                <p className="text-sm text-muted-foreground">
                  {account.provider === "GOOGLE" ? "Google / Gmail" : "Microsoft 365"}
                </p>
              </div>
              <DisconnectButton accountId={account.id} />
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">Noch kein Postfach verbunden.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Postfach verbinden</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          {googleConfigured ? (
            <Button nativeButton={false} render={<a href="/api/mailbox/google/connect" />}>
              Gmail verbinden
            </Button>
          ) : (
            <Button disabled>Gmail verbinden</Button>
          )}
          {microsoftConfigured ? (
            <Button variant="outline" nativeButton={false} render={<a href="/api/mailbox/microsoft/connect" />}>
              Microsoft 365 verbinden
            </Button>
          ) : (
            <Button disabled variant="outline">
              Microsoft 365 verbinden
            </Button>
          )}
        </CardContent>
        {(!googleConfigured || !microsoftConfigured) && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Hinweis: OAuth-Zugangsdaten sind noch nicht konfiguriert (GOOGLE_CLIENT_ID / MICROSOFT_CLIENT_ID in den
              Umgebungsvariablen).
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
