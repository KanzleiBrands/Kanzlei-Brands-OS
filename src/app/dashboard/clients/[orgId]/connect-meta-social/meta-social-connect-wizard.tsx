"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { checkInstagramForSocialPage, finalizeMetaSocialConnection } from "@/lib/actions/social-channels";

type Page = { id: string; name: string };

/** A malformed/oversized Server Action response (e.g. a slow Meta call hitting the function timeout) surfaces client-side as a raw, unlocalized "Minified React error #…" - never show that to the user. */
function friendlyMetaError(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  if (!message || /React error #\d+/.test(message)) {
    return "Die Anfrage an Facebook hat zu lange gedauert oder ist fehlgeschlagen. Bitte versuche es erneut.";
  }
  return message;
}

export function MetaSocialConnectWizard({ organizationId, pages }: { organizationId: string; pages: Page[] }) {
  const router = useRouter();
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [instagramAccount, setInstagramAccount] = useState<{ id: string; username?: string } | null | undefined>(
    undefined,
  );
  const [connectFacebook, setConnectFacebook] = useState(true);
  const [connectInstagram, setConnectInstagram] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectPage(page: Page) {
    setSelectedPage(page);
    setInstagramAccount(undefined);
    setConnectFacebook(true);
    setConnectInstagram(true);
    setError(null);
    startTransition(async () => {
      try {
        const account = await checkInstagramForSocialPage(organizationId, page.id);
        setInstagramAccount(account);
        setConnectInstagram(!!account);
      } catch (e) {
        setError(friendlyMetaError(e));
      }
    });
  }

  function handleConfirm() {
    if (!selectedPage) return;
    setError(null);
    startTransition(async () => {
      try {
        await finalizeMetaSocialConnection(organizationId, selectedPage.id, {
          connectFacebook,
          connectInstagram: connectInstagram && !!instagramAccount,
        });
        router.push(`/dashboard/clients/${organizationId}?tab=content&metaConnected=1`);
      } catch (e) {
        setError(friendlyMetaError(e));
      }
    });
  }

  if (pages.length === 0) {
    return (
      <p className="text-muted-foreground">
        Keine Facebook-Seiten gefunden, für die du Admin-Rechte hast. Bitte in Facebook prüfen und erneut versuchen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">1. Facebook-Seite</p>
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <Button
              key={page.id}
              type="button"
              variant={selectedPage?.id === page.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelectPage(page)}
            >
              {page.name}
            </Button>
          ))}
        </div>
      </div>

      {selectedPage && (
        <div>
          <p className="mb-2 text-sm font-medium">2. Kanäle</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={connectFacebook} onCheckedChange={(c) => setConnectFacebook(!!c)} />
              Facebook-Seite &bdquo;{selectedPage.name}&ldquo;
            </label>
            {instagramAccount === undefined && isPending && (
              <p className="text-sm text-muted-foreground">Prüfe verknüpftes Instagram-Konto...</p>
            )}
            {instagramAccount === null && (
              <p className="text-sm text-muted-foreground">
                Keine Instagram-Konto mit dieser Seite verknüpft - nur Facebook wird verbunden.
              </p>
            )}
            {instagramAccount && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={connectInstagram} onCheckedChange={(c) => setConnectInstagram(!!c)} />
                Instagram {instagramAccount.username ? `@${instagramAccount.username}` : ""}
              </label>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        disabled={!selectedPage || (!connectFacebook && !connectInstagram) || isPending}
        onClick={handleConfirm}
        className="self-start"
      >
        {isPending ? "Verbinde..." : "Verbinden"}
      </Button>
    </div>
  );
}
