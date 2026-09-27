import { randomBytes } from "crypto";

const CALENDLY_API_BASE = "https://api.calendly.com";

/**
 * Minimaler Calendly-REST-Client für das einmalige automatische Einrichten
 * des Webhook-Abos (statt es manuell im Calendly-UI anzulegen). Nutzt einen
 * Personal Access Token mit Scope webhooks:read/webhooks:write (siehe
 * .env.example CALENDLY_API_TOKEN) - komplett getrennt vom
 * CALENDLY_WEBHOOK_SIGNING_KEY, der nur zur Signaturprüfung eingehender
 * Events dient.
 */
async function calendlyFetch<T>(path: string, apiToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CALENDLY_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Calendly-API-Fehler (${res.status}) bei ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

async function getOrganizationUri(apiToken: string): Promise<string> {
  const data = await calendlyFetch<{ resource: { current_organization: string } }>("/users/me", apiToken);
  return data.resource.current_organization;
}

type CalendlyWebhookSubscription = {
  uri: string;
  callback_url: string;
  state: string;
  events: string[];
  signing_key?: string;
};

export type EnsureWebhookResult =
  | { ok: true; created: false; existingUri: string }
  | { ok: true; created: true; signingKey: string }
  | { ok: false; error: string };

/**
 * Legt (idempotent) ein Organization-Webhook-Abo für "invitee.created" auf
 * die übergebene callbackUrl an. Calendlys API erlaubt beim Anlegen einen
 * selbst gewählten signing_key im Request-Body - wir generieren einen
 * kryptographisch zufälligen Wert und verwenden GENAU diesen danach als
 * CALENDLY_WEBHOOK_SIGNING_KEY. Liest zur Sicherheit trotzdem
 * response.resource.signing_key zurück, falls Calendly stattdessen einen
 * eigenen zurückgibt (Verhalten war aus dieser Session heraus nicht live
 * gegen den echten Account verifizierbar - die Aktion zeigt das tatsächliche
 * Ergebnis transparent an, statt es zu verschweigen).
 */
export async function ensureCalendlyWebhookSubscription(apiToken: string, callbackUrl: string): Promise<EnsureWebhookResult> {
  try {
    const organization = await getOrganizationUri(apiToken);

    const existing = await calendlyFetch<{ collection: CalendlyWebhookSubscription[] }>(
      `/webhook_subscriptions?organization=${encodeURIComponent(organization)}&scope=organization&count=100`,
      apiToken,
    );
    const already = existing.collection.find((w) => w.callback_url === callbackUrl && w.state === "active");
    if (already) return { ok: true, created: false, existingUri: already.uri };

    const signingKey = randomBytes(32).toString("hex");
    const created = await calendlyFetch<{ resource: CalendlyWebhookSubscription }>("/webhook_subscriptions", apiToken, {
      method: "POST",
      body: JSON.stringify({
        url: callbackUrl,
        events: ["invitee.created"],
        organization,
        scope: "organization",
        signing_key: signingKey,
      }),
    });

    return { ok: true, created: true, signingKey: created.resource.signing_key ?? signingKey };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Calendly-API." };
  }
}
