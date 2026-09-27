"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { runTellentImport, type TellentImportResult } from "@/lib/actions/tellent-import";

export function TellentImportForm() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<TellentImportResult | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function run(apply: boolean) {
    setError(undefined);
    const formData = new FormData();
    formData.set("apiKey", apiKey);
    formData.set("apply", apply ? "true" : "false");
    startTransition(async () => {
      try {
        const res = await runTellentImport(formData);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Tellent-API-Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={isPending}
          className="h-9 max-w-md"
          placeholder="X-Api-Key"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isPending || !apiKey} onClick={() => run(false)}>
          Vorschau
        </Button>
        <Button type="button" size="sm" disabled={isPending || !apiKey || !result} onClick={() => run(true)}>
          Übernehmen
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4 text-sm">
          {result.applied && <p className="font-medium text-green-700 dark:text-green-500">Änderungen wurden übernommen.</p>}

          <div>
            <p className="mb-2 font-medium">{result.matched.length} zugeordnete Mitarbeiter:innen</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">E-Mail</th>
                    <th className="p-2 text-left">Position</th>
                    <th className="p-2 text-left">Standort</th>
                    <th className="p-2 text-left">Geburtstag</th>
                    <th className="p-2 text-left">Eintritt</th>
                    <th className="p-2 text-left">Austritt</th>
                    <th className="p-2 text-left">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matched.map((m) => (
                    <tr key={m.ourEmail} className="border-b last:border-0">
                      <td className="p-2">{m.ourName}</td>
                      <td className="p-2">{m.ourEmail}</td>
                      <td className="p-2">{m.position ?? "-"}</td>
                      <td className="p-2">{m.location ?? "-"}</td>
                      <td className="p-2">{m.birthday ?? "-"}</td>
                      <td className="p-2">{m.hireDate ?? "-"}</td>
                      <td className="p-2">{m.employmentEndedAt ?? "-"}</td>
                      <td className="p-2">{m.managerEmail ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.balances.length > 0 && (
            <div>
              <p className="mb-2 font-medium">
                {result.balances.length} Urlaubskonten (Jahres-Kontingent &quot;Urlaub&quot; wird angelegt/aktualisiert)
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Tellent liefert keine einzelnen datierten Anträge, nur Jahres-Salden. Das Kontingent wird als
                Urlaubskonto übernommen, die genutzten Tage zusätzlich als Sammel-Antrag (siehe unten).
              </p>
              <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-md border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-right">Jahr</th>
                      <th className="p-2 text-right">Kontingent (Tage)</th>
                      <th className="p-2 text-right">Bereits genutzt (Tellent)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.balances.map((b) => (
                      <tr key={`${b.ourEmail}-${b.year}`} className="border-b last:border-0">
                        <td className="p-2">{b.ourName}</td>
                        <td className="p-2 text-right tabular-nums">{b.year}</td>
                        <td className="p-2 text-right tabular-nums">{b.totalDays}</td>
                        <td className="p-2 text-right tabular-nums">{b.usedInTellent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.absenceSummaries.length > 0 && (
            <div>
              <p className="mb-2 font-medium">
                {result.absenceSummaries.length} Abwesenheits-Sammelanträge (Urlaub, Krank, Homeoffice, Sonstige)
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Tellent liefert pro Person/Art/Jahr nur eine Summe, keine einzelnen datierten Anträge. Diese Zeilen
                werden je Person/Art/Jahr als EIN genehmigter Sammel-Antrag mit der Jahressumme angelegt (Datum
                1.1. des Jahres als Platzhalter, im Antrag klar als &quot;[Tellent-Import]&quot; markiert). Bei
                erneutem Übernehmen werden bestehende Sammelanträge ersetzt, es entstehen keine Duplikate.
              </p>
              <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-md border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Abwesenheitsart</th>
                      <th className="p-2 text-right">Jahr</th>
                      <th className="p-2 text-right">Tage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.absenceSummaries.map((s) => (
                      <tr key={`${s.ourEmail}-${s.absenceTypeName}-${s.year}`} className="border-b last:border-0">
                        <td className="p-2">{s.ourName}</td>
                        <td className="p-2">{s.absenceTypeName}</td>
                        <td className="p-2 text-right tabular-nums">{s.year}</td>
                        <td className="p-2 text-right tabular-nums">{s.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.unmatchedTellent.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Tellent-Nutzer ohne Treffer bei uns</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {result.unmatchedTellent.map((t) => (
                  <li key={t.email}>{t.name} &lt;{t.email}&gt;</li>
                ))}
              </ul>
            </div>
          )}

          {result.unmatchedOurs.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Unsere Mitarbeiter ohne Treffer bei Tellent</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {result.unmatchedOurs.map((u) => (
                  <li key={u.email}>{u.name} &lt;{u.email}&gt;</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
