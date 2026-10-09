"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LockIcon } from "lucide-react";
import { requestSocialContentUnlock, toggleSocialContentBooked } from "@/lib/actions/social-content-unlock";
import { SOCIAL_CONTENT_PRICE_LABEL } from "@/lib/social-content/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/** Mirrors EmailMarketingPaywall in email-marketing-tab.tsx. */
export function SocialContentPaywall({ organizationId }: { organizationId: string }) {
  const [error, formAction, isPending] = useActionState(requestSocialContentUnlock, undefined);
  const [requested, setRequested] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setRequested(true);
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <LockIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Social Media Content Management freischalten</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Überzeuge potenzielle Mitarbeiter oder Mandanten von deiner Kanzlei durch einen vertrauensvollen,
            attraktiven Social-Media-Auftritt und relevante Inhalte auf Instagram, Facebook und LinkedIn.
          </p>
        </div>
        {requested ? (
          <p className="text-sm text-green-600">Anfrage gesendet - wir melden uns bei dir.</p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Wird gesendet..." : `Freischalten für ${SOCIAL_CONTENT_PRICE_LABEL}`}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/** Mirrors BookedToggle in email-marketing-tab.tsx - shown nur, wenn ein Agentur-Admin diesen Kunden gerade impersoniert. */
export function SocialContentBookedToggle({ organizationId, booked }: { organizationId: string; booked: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2.5 text-sm">
      <Switch
        defaultChecked={booked}
        disabled={isPending}
        onCheckedChange={() => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          startTransition(() => {
            toggleSocialContentBooked(formData);
          });
        }}
      />
      Dieser Kunde hat Social Media Content gebucht
    </label>
  );
}
