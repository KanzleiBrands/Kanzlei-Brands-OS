"use client";

import { useActionState, useTransition } from "react";
import { creditPartnerAction, adjustPartnerPoints } from "@/lib/actions/partner-program";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

type PartnerActionOption = { id: string; title: string; points: number };
type TransactionRow = {
  id: string;
  kind: "EARNED" | "REDEEMED" | "ADJUSTMENT";
  points: number;
  note: string | null;
  actionTitle: string | null;
  rewardTitle: string | null;
  userName: string | null;
  createdAt: string;
};

const KIND_LABELS: Record<TransactionRow["kind"], string> = {
  EARNED: "Gutgeschrieben",
  REDEEMED: "Eingelöst",
  ADJUSTMENT: "Korrektur",
};

function CreditActionButton({ organizationId, action }: { organizationId: string; action: PartnerActionOption }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("actionId", action.id);
        startTransition(() => {
          creditPartnerAction(formData);
        });
      }}
    >
      + {action.points} für &bdquo;{action.title}&ldquo;
    </Button>
  );
}

function AdjustPointsForm({ organizationId }: { organizationId: string }) {
  const [error, formAction, isPending] = useActionState(adjustPartnerPoints, undefined);
  useSaveToast(error, isPending, "Punktestand angepasst.");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Punkte (+/-)</label>
        <Input name="points" type="number" placeholder="z.B. 10 oder -5" className="w-32" required />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs text-muted-foreground">Notiz</label>
        <Input name="note" placeholder="Grund der Korrektur (optional)" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Wird gespeichert..." : "Anpassen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

export function PartnerProgramTab({
  organizationId,
  balance,
  actions,
  transactions,
}: {
  organizationId: string;
  balance: number;
  actions: PartnerActionOption[];
  transactions: TransactionRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="w-fit min-w-56">
        <CardHeader>
          <CardTitle>Aktueller Punktestand</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{balance}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Punkte gutschreiben</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <CreditActionButton key={action.id} organizationId={organizationId} action={action} />
            ))}
            {actions.length === 0 && <p className="text-sm text-muted-foreground">Keine aktiven Aktionen im Katalog.</p>}
          </div>
          <AdjustPointsForm organizationId={organizationId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verlauf</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
              <span className={`w-24 shrink-0 font-medium ${t.points >= 0 ? "text-green-600" : "text-destructive"}`}>
                {t.points >= 0 ? "+" : ""}
                {t.points}
              </span>
              <span className="flex-1 truncate text-muted-foreground">
                {KIND_LABELS[t.kind]}
                {t.actionTitle && ` · ${t.actionTitle}`}
                {t.rewardTitle && ` · ${t.rewardTitle}`}
                {t.note && ` · ${t.note}`}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{t.userName ?? "System"}</span>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{t.createdAt}</span>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Punkte-Bewegungen.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
