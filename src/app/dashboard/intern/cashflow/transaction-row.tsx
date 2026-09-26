"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteCashflowTransaction } from "@/lib/actions/cashflow";
import { Trash2Icon } from "lucide-react";

export function TransactionRow({
  id,
  date,
  counterparty,
  categoryLabel,
  amountNet,
  taxRatePercent,
  bankSource,
  note,
}: {
  id: string;
  date: string;
  counterparty: string;
  categoryLabel: string;
  amountNet: string;
  taxRatePercent: number;
  bankSource: string | null;
  note: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b last:border-0">
      <td className="p-2 whitespace-nowrap">{date}</td>
      <td className="p-2">{counterparty}</td>
      <td className="p-2 text-muted-foreground">{categoryLabel}</td>
      <td className="p-2 text-right tabular-nums">{amountNet}</td>
      <td className="p-2 text-right tabular-nums">{taxRatePercent}%</td>
      <td className="p-2 text-muted-foreground">{bankSource ?? "–"}</td>
      <td className="p-2 text-muted-foreground">{note}</td>
      <td className="p-2 text-right">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("id", id);
            startTransition(async () => {
              await deleteCashflowTransaction(formData);
            });
          }}
        >
          <Trash2Icon className="size-4 text-muted-foreground" />
        </Button>
      </td>
    </tr>
  );
}
