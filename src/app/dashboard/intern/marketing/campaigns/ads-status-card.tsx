import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";

type PlatformStatus = { label: string; connected: boolean; missing: string[] };

function statusFor(label: string, vars: string[]): PlatformStatus {
  const missing = vars.filter((v) => !process.env[v]);
  return { label, connected: missing.length === 0, missing };
}

/** Zeigt live, welche Ads-APIs schon automatisch laufen und was für welche Plattform noch fehlt - kein Rätselraten nötig. */
export function AdsStatusCard() {
  const statuses = [
    statusFor("Meta", ["META_ADS_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]),
    statusFor("Google", ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]),
    statusFor("LinkedIn", ["LINKEDIN_ADS_ACCESS_TOKEN", "LINKEDIN_AD_ACCOUNT_ID"]),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatischer Werbekosten-Abgleich</CardTitle>
        <p className="text-sm text-muted-foreground">
          Läuft nachts automatisch pro Plattform, sobald der jeweilige API-Zugang gesetzt ist - kein Klick nötig.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {statuses.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            {s.connected ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : <CircleIcon className="size-4 text-muted-foreground" />}
            <span className="font-medium">{s.label}</span>
            <span className="text-muted-foreground">
              {s.connected ? "verbunden - läuft automatisch" : `noch nicht eingerichtet (${s.missing.join(", ")} fehlt)`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
