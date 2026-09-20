import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function RetentionRow({
  label,
  months,
  helpText,
}: {
  label: string;
  months: number | null;
  helpText: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        {months !== null ? (
          <Badge>Aktiv - nach {months} {months === 1 ? "Monat" : "Monaten"}</Badge>
        ) : (
          <Badge variant="secondary">Deaktiviert</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{helpText}</p>
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
            Diese Einstellung wird von Kanzlei Brands als Auftragsverarbeiter für euch verwaltet und ist hier immer
            aktuell - so seht ihr jederzeit, was bei euch konfiguriert ist. Bei Fragen oder Änderungswünschen meldet
            euch einfach bei eurem Ansprechpartner.
          </p>
          <RetentionRow
            label="Abgelehnte Bewerber"
            months={applicantDataRetentionMonths}
            helpText="Kontakte in einer Ungeeignet-Stufe eurer Recruiting-Kampagnen werden nach Ablauf der Frist vollständig gelöscht (nicht nur anonymisiert)."
          />
          <RetentionRow
            label="Nicht zustande gekommene Mandatsanfragen"
            months={leadDataRetentionMonths}
            helpText="Kontakte in einer Ungeeignet-Stufe eurer Mandatsakquise-Kampagnen werden nach Ablauf der Frist vollständig gelöscht (nicht nur anonymisiert)."
          />
        </CardContent>
      </Card>
    </div>
  );
}
