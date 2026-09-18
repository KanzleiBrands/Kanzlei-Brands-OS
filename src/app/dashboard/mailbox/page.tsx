import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DisconnectButton } from "./disconnect-button";

export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { connected, error } = await searchParams;

  const accounts = await prisma.emailAccount.findMany({ where: { userId: session.user.id } });
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID;

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-semibold">E-Mail-Postfach</h1>
      <p className="mb-6 text-muted-foreground">
        Verbinde dein Postfach, um E-Mails direkt aus der Plattform an Leads zu senden. Sie werden automatisch am
        jeweiligen Kontakt gespeichert.
      </p>

      {connected && <p className="mb-4 text-sm text-green-600">Postfach erfolgreich verbunden.</p>}
      {error && <p className="mb-4 text-sm text-destructive">Verbindung fehlgeschlagen ({error}).</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Verbundene Postfächer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{account.email}</p>
                <p className="text-xs text-muted-foreground">
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
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/api/mailbox/microsoft/connect" />}
            >
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
            <p className="text-xs text-muted-foreground">
              Hinweis: OAuth-Zugangsdaten sind noch nicht konfiguriert (GOOGLE_CLIENT_ID / MICROSOFT_CLIENT_ID in den
              Umgebungsvariablen).
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
