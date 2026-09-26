"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { listPhoneNumbersForWaba, finalizeWhatsAppConnection } from "@/lib/actions/whatsapp-channels";

type BusinessAccount = { id: string; name: string };
type PhoneNumber = { id: string; display_phone_number: string; verified_name: string };

/** A malformed/oversized Server Action response surfaces client-side as a raw, unlocalized "Minified React error #…" - never show that to the user. */
function friendlyMetaError(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  if (!message || /React error #\d+/.test(message)) {
    return "Die Anfrage an Facebook hat zu lange gedauert oder ist fehlgeschlagen. Bitte versuche es erneut.";
  }
  return message;
}

export function WhatsAppConnectWizard({ businessAccounts }: { businessAccounts: BusinessAccount[] }) {
  const router = useRouter();
  const [selectedWaba, setSelectedWaba] = useState<BusinessAccount | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[] | undefined>(undefined);
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectWaba(waba: BusinessAccount) {
    setSelectedWaba(waba);
    setPhoneNumbers(undefined);
    setSelectedPhone(null);
    setError(null);
    startTransition(async () => {
      try {
        const numbers = await listPhoneNumbersForWaba(waba.id);
        setPhoneNumbers(numbers);
      } catch (e) {
        setError(friendlyMetaError(e));
      }
    });
  }

  function handleConfirm() {
    if (!selectedWaba || !selectedPhone) return;
    setError(null);
    startTransition(async () => {
      try {
        await finalizeWhatsAppConnection(selectedWaba.id, selectedPhone);
        router.push("/dashboard/intern/marketing/whatsapp?connected=1");
      } catch (e) {
        setError(friendlyMetaError(e));
      }
    });
  }

  if (businessAccounts.length === 0) {
    return (
      <p className="text-muted-foreground">
        Kein WhatsApp-Business-Konto gefunden, für das du Admin-Rechte hast. Bitte in der Meta Business Suite prüfen
        und erneut versuchen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">1. WhatsApp-Business-Konto</p>
        <div className="flex flex-wrap gap-2">
          {businessAccounts.map((waba) => (
            <Button
              key={waba.id}
              type="button"
              variant={selectedWaba?.id === waba.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelectWaba(waba)}
            >
              {waba.name}
            </Button>
          ))}
        </div>
      </div>

      {selectedWaba && (
        <div>
          <p className="mb-2 text-sm font-medium">2. Telefonnummer</p>
          {phoneNumbers === undefined && isPending && <p className="text-sm text-muted-foreground">Lade Telefonnummern...</p>}
          {phoneNumbers?.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Telefonnummer in diesem Konto registriert.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {phoneNumbers?.map((phone) => (
              <Button
                key={phone.id}
                type="button"
                variant={selectedPhone?.id === phone.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPhone(phone)}
              >
                {phone.display_phone_number} ({phone.verified_name})
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" disabled={!selectedPhone || isPending} onClick={handleConfirm} className="self-start">
        {isPending ? "Verbinde..." : "Verbinden"}
      </Button>
    </div>
  );
}
