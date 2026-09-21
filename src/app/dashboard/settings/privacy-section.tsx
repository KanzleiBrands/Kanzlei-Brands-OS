import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function monthsLabel(months: number) {
  return `${months} ${months === 1 ? "Monat" : "Monaten"}`;
}

function RetentionRow({
  label,
  months,
  description,
  legalBasis,
}: {
  label: string;
  months: number | null;
  description: string;
  legalBasis: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        {months !== null ? (
          <Badge>Aktiv - nach {monthsLabel(months)}</Badge>
        ) : (
          <Badge variant="secondary">Deaktiviert</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {months !== null
          ? `${description} nach Ablauf von ${monthsLabel(months)} vollständig gelöscht.`
          : `${description} aktuell nicht automatisch gelöscht, da keine Frist hinterlegt ist.`}
      </p>
      <p className="text-sm text-muted-foreground">{legalBasis}</p>
    </div>
  );
}

export function PrivacySection({
  applicantDataRetentionMonths,
  leadDataRetentionMonths,
}: {
  applicantDataRetentionMonths: number | null;
  leadDataRetentionMonths: number | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Datenschutz (DSGVO)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Diese Einstellung wird von Kanzlei Brands als Auftragsverarbeiter für dich verwaltet und ist hier immer
            aktuell - so siehst du jederzeit, was bei dir konfiguriert ist. Bei Fragen oder Änderungswünschen melde
            dich einfach bei deinem Ansprechpartner.
          </p>
          <RetentionRow
            label="Abgelehnte Bewerber"
            months={applicantDataRetentionMonths}
            description="Kontakte in einer Ungeeignet-Stufe deiner Recruiting-Kampagnen werden"
            legalBasis="Rechtsgrundlage: Löschpflicht aus dem Grundsatz der Speicherbegrenzung (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO). Die Aufbewahrung bis dahin stützt sich auf das berechtigte Interesse (Art. 6 Abs. 1 lit. f DSGVO), Beweise für die Verteidigung gegen mögliche AGG-Ansprüche vorzuhalten: § 15 Abs. 4 AGG setzt dafür eine Frist von 2 Monaten ab Zugang der Ablehnung, zzgl. der 3-monatigen Klagefrist nach § 61b Abs. 1 ArbGG - in der Praxis werden dafür üblicherweise 6 Monate angesetzt."
          />
          <RetentionRow
            label="Nicht zustande gekommene Mandatsanfragen"
            months={leadDataRetentionMonths}
            description="Kontakte in einer Ungeeignet-Stufe deiner Mandatsakquise-Kampagnen werden"
            legalBasis="Rechtsgrundlage: Grundsatz der Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO) und Recht auf Löschung (Art. 17 DSGVO). Für Mandatsanfragen gibt es keine gesetzliche Mindestfrist wie beim AGG - die Frist wird individuell mit Kanzlei Brands abgestimmt."
          />
        </CardContent>
      </Card>
    </div>
  );
}
