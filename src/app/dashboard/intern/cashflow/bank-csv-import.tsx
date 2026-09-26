"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importCashOutTransactions } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

const CATEGORIES = [
  { value: "PERSONNEL", label: "Mitarbeiter & Freelancer" },
  { value: "MARKETING", label: "Marketing" },
  { value: "INFRASTRUCTURE", label: "Infrastruktur & Software" },
  { value: "VARIABLE", label: "Variable Kosten" },
  { value: "AD_BUDGET", label: "Werbebudget Auslage" },
  { value: "TAXES", label: "Steuern" },
] as const;

type Source = "VOLKSBANK" | "AMEX";

type ParsedRow = {
  key: string;
  transactionDate: string; // ISO
  counterparty: string;
  amountNet: number;
  category: string;
  taxRatePercent: number;
  include: boolean;
  flagReason: string | null;
};

function parseGermanAmount(raw: string): number {
  return Number(raw.trim().replace(/\./g, "").replace(",", "."));
}

/** Zerlegt eine CSV-Zeile respektvoll gegenüber angeführten Feldern (die selbst das Trennzeichen enthalten können). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseVolksbankCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("Datei enthält keine Buchungszeilen.");

  const header = splitCsvLine(lines[0], ";").map((h) => h.trim());
  const dateIdx = header.indexOf("Buchungstag");
  const counterpartyIdx = header.indexOf("Name Zahlungsbeteiligter");
  const amountIdx = header.indexOf("Betrag");
  if (dateIdx === -1 || counterpartyIdx === -1 || amountIdx === -1) {
    throw new Error("Unbekanntes Volksbank-CSV-Format - Spalten 'Buchungstag'/'Name Zahlungsbeteiligter'/'Betrag' fehlen.");
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], ";");
    const amount = parseGermanAmount(cols[amountIdx] ?? "");
    if (Number.isNaN(amount) || amount >= 0) continue; // nur Geldabgänge (negative Beträge)

    const counterparty = (cols[counterpartyIdx] ?? "").trim() || "Unbekannt";
    const [day, month, year] = (cols[dateIdx] ?? "").trim().split(".");
    const amexSuspect = /amex|american express/i.test(counterparty);
    rows.push({
      key: `vb-${i}`,
      transactionDate: `${year}-${month}-${day}`,
      counterparty,
      amountNet: Math.abs(amount),
      category: "VARIABLE",
      taxRatePercent: 19,
      include: !amexSuspect,
      flagReason: amexSuspect ? "vermutlich Amex-Sammelbuchung - wird separat importiert" : null,
    });
  }
  if (rows.length === 0) throw new Error("Keine Geldabgänge (negative Beträge) in der Datei gefunden.");
  return rows;
}

function parseAmexCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("Datei enthält keine Buchungszeilen.");

  const header = splitCsvLine(lines[0], ",").map((h) => h.trim());
  const dateIdx = header.indexOf("Datum");
  const descriptionIdx = header.indexOf("Beschreibung");
  const amountIdx = header.indexOf("Betrag");
  if (dateIdx === -1 || descriptionIdx === -1 || amountIdx === -1) {
    throw new Error("Unbekanntes Amex-CSV-Format - Spalten 'Datum'/'Beschreibung'/'Betrag' fehlen.");
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], ",");
    const amount = parseGermanAmount(cols[amountIdx] ?? "");
    // Bei Amex sind Käufe positiv, Kartenzahlungen ans Konto + Rückerstattungen negativ - nur Käufe zählen als Cash-Out.
    if (Number.isNaN(amount) || amount <= 0) continue;

    const counterparty = (cols[descriptionIdx] ?? "").trim().replace(/\s{2,}/g, " ") || "Unbekannt";
    const [day, month, year] = (cols[dateIdx] ?? "").trim().split("/");
    rows.push({
      key: `ax-${i}`,
      transactionDate: `${year}-${month}-${day}`,
      counterparty,
      amountNet: amount,
      category: "VARIABLE",
      taxRatePercent: 19,
      include: true,
      flagReason: null,
    });
  }
  if (rows.length === 0) throw new Error("Keine Kartenkäufe (positive Beträge) in der Datei gefunden.");
  return rows;
}

/**
 * CSV-Import für Cash-Out - unterstützt zwei Formate, beide gegen echte
 * Beispiel-Exporte geprüft: den Hamburger-Volksbank-Kontoauszug (semikolon-
 * getrennt, negative Beträge = Geldabgang) und den Amex-Kartenumsatz-Export
 * (komma-getrennt, positive Beträge = Kartenkauf). Vermutliche
 * Amex-Sammelbuchungen im Volksbank-Export werden vorab abgewählt, da die
 * Einzelbuchungen separat über den Amex-Export importiert werden.
 */
export function BankCsvImport({ organizationId }: { organizationId: string }) {
  const [source, setSource] = useState<Source>("VOLKSBANK");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | undefined>(undefined);
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(importError, isPending, "Buchungen importiert.");

  function handleFile(file: File, selectedSource: Source) {
    setParseError(undefined);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        setRows(selectedSource === "VOLKSBANK" ? parseVolksbankCsv(text) : parseAmexCsv(text));
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function updateRow(key: string, patch: Partial<ParsedRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  function importSelected() {
    if (!rows) return;
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) {
      setImportError("Keine Buchungen ausgewählt.");
      return;
    }
    const bankSource = source === "VOLKSBANK" ? "Volksbank HH" : "Amex";
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set(
      "rows",
      JSON.stringify(
        selected.map((r) => ({
          transactionDate: r.transactionDate,
          counterparty: r.counterparty,
          amountNet: r.amountNet,
          category: r.category,
          taxRatePercent: r.taxRatePercent,
          bankSource,
        })),
      ),
    );
    startTransition(async () => {
      const result = await importCashOutTransactions(formData);
      setImportError(result);
      if (!result) setRows(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-foreground/15 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Bank-CSV importieren</label>
        <Select value={source} onValueChange={(value) => { setSource(value as Source); setRows(null); }}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="VOLKSBANK">Volksbank HH</SelectItem>
            <SelectItem value="AMEX">Amex</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="file"
          accept=".csv"
          className="h-9 w-64"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file, source);
          }}
        />
      </div>
      {parseError && <p className="text-sm text-red-600">{parseError}</p>}

      {rows && (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} Buchungen gefunden.
            {source === "VOLKSBANK" && " Vermutliche Amex-Sammelbuchungen sind vorab abgewählt."} Bitte Kategorie je
            Zeile prüfen.
          </p>
          <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="p-2 text-left" />
                  <th className="p-2 text-left font-medium text-muted-foreground">Datum</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Gegenpartei</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">Betrag</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Kategorie</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Steuersatz</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={`border-b last:border-0 ${row.flagReason ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">{row.transactionDate}</td>
                    <td className="p-2">
                      {row.counterparty}
                      {row.flagReason && <span className="ml-2 text-xs text-amber-600">{row.flagReason}</span>}
                    </td>
                    <td className="p-2 text-right tabular-nums">{row.amountNet.toFixed(2)} €</td>
                    <td className="p-2">
                      <Select value={row.category} onValueChange={(value) => updateRow(row.key, { category: value ?? "VARIABLE" })}>
                        <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select value={String(row.taxRatePercent)} onValueChange={(value) => updateRow(row.key, { taxRatePercent: Number(value ?? 19) })}>
                        <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="7">7%</SelectItem>
                          <SelectItem value="19">19%</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={importSelected}>
              {rows.filter((r) => r.include).length} Buchungen importieren
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setRows(null)}>
              Abbrechen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
