"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "lucide-react";

export function TrackingSnippetCard({ baseUrl, organizationId }: { baseUrl: string; organizationId: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${baseUrl}/tracking.js" data-org="${organizationId}"></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracking-Snippet</CardTitle>
        <p className="text-sm text-muted-foreground">
          In jede Landingpage einbauen (vor dem schließenden <code>&lt;/body&gt;</code>). Erfasst UTM-Parameter und
          Click-IDs beim Landing first-party und meldet sie hierher - unabhängig davon, wohin das Formular selbst
          sendet. Beim Formular-Absenden zusätzlich <code>window.KBTrack.identify(email)</code> aufrufen, um den
          bisherigen anonymen Verlauf mit der E-Mail zu verknüpfen.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
          <code className="flex-1 overflow-x-auto text-xs whitespace-nowrap">{snippet}</code>
          <Button type="button" size="icon" variant="ghost" onClick={copy}>
            {copied ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
