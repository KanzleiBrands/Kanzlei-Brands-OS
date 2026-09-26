"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addCashflowTransaction } from "@/lib/actions/cashflow";
import { useSaveToast } from "@/hooks/use-save-toast";

const CATEGORIES = [
  { value: "PERSONNEL", label: "Mitarbeiter & Freelancer" },
  { value: "MARKETING", label: "Marketing" },
  { value: "INFRASTRUCTURE", label: "Infrastruktur & Software" },
  { value: "VARIABLE", label: "Variable Kosten" },
  { value: "AD_BUDGET", label: "Werbebudget Auslage" },
] as const;

export function AddTransactionForm({ organizationId }: { organizationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<string>("VARIABLE");
  const [taxRatePercent, setTaxRatePercent] = useState<string>("19");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  useSaveToast(error, isPending, "Buchung gespeichert.");

  function submit(formData: FormData) {
    formData.set("organizationId", organizationId);
    formData.set("category", category);
    formData.set("taxRatePercent", taxRatePercent);
    formData.set("bankSource", "Manuell");
    startTransition(async () => {
      const result = await addCashflowTransaction(formData);
      setError(result);
      if (!result) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-foreground/15 p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Datum</label>
        <Input type="date" name="transactionDate" required disabled={isPending} className="h-9 w-40" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Gegenpartei</label>
        <Input type="text" name="counterparty" required disabled={isPending} className="h-9 w-48" placeholder="Firma / Empfänger" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Kategorie</label>
        <Select value={category} onValueChange={(value) => setCategory(value ?? "VARIABLE")} disabled={isPending}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Betrag, netto</label>
        <Input type="number" name="amountNet" min={0} step="0.01" required disabled={isPending} className="h-9 w-32" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Steuersatz</label>
        <Select value={taxRatePercent} onValueChange={(value) => setTaxRatePercent(value ?? "19")} disabled={isPending}>
          <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0%</SelectItem>
            <SelectItem value="7">7%</SelectItem>
            <SelectItem value="19">19%</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-40 flex-1">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Notiz (optional)</label>
        <Input type="text" name="note" disabled={isPending} className="h-9" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>Buchung hinzufügen</Button>
    </form>
  );
}
