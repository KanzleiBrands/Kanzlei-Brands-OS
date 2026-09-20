"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, LockIcon, PlusIcon } from "lucide-react";
import { requestAdditionalQuota } from "@/lib/actions/campaign-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Kind = "LEADS" | "APPLICANTS";

const KIND_TITLES: Record<Kind, string> = {
  APPLICANTS: "Weitere Stelle ausschreiben",
  LEADS: "Neues Themenfeld beauftragen",
};

export function CampaignRequestCard({
  organizationId,
  kind,
  used,
  quota,
  formUrl,
  canRequest,
}: {
  organizationId: string;
  kind: Kind;
  used: number;
  quota: number | null;
  formUrl: string | null;
  canRequest: boolean;
}) {
  const [error, formAction, isPending] = useActionState(requestAdditionalQuota, undefined);
  const [sent, setSent] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setSent(true);
    wasPending.current = isPending;
  }, [isPending, error]);

  const quotaExhausted = quota !== null && used >= quota;
  const canSelfServe = !!formUrl && !quotaExhausted;

  return (
    <Card className={canSelfServe ? undefined : "border-dashed bg-muted/30"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {canSelfServe ? <PlusIcon className="size-4" /> : <LockIcon className="size-4 text-muted-foreground" />}
          {KIND_TITLES[kind]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {quota !== null && (
          <p className="text-sm text-muted-foreground">
            {used} von {quota} Kampagnen in Gebrauch
          </p>
        )}

        {canSelfServe ? (
          <Button type="button" size="sm" nativeButton={false} render={<a href={formUrl} target="_blank" rel="noopener noreferrer" />}>
            Formular öffnen
            <ExternalLinkIcon className="size-3.5" />
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {quotaExhausted
                ? "Dein gebuchtes Kontingent ist aktuell ausgeschöpft."
                : "Dafür meldet sich dein Account Manager persönlich bei dir."}
            </p>
            {canRequest ? (
              sent ? (
                <p className="text-sm font-medium text-emerald-500">Anfrage gesendet ✓</p>
              ) : (
                <form action={formAction}>
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="kind" value={kind} />
                  <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                    {isPending ? "Wird gesendet..." : "Anfrage an Account Manager senden"}
                  </Button>
                </form>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Nur Admins können weitere Kampagnen beauftragen.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
