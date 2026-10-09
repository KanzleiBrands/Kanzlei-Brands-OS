"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Google Search Console ist noch nicht eingerichtet (GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET fehlen in Vercel).",
  invalid_state: "Verbindung abgebrochen oder abgelaufen - bitte erneut versuchen.",
  connect_failed: "Verbindung zu Google Search Console fehlgeschlagen.",
};

/**
 * Die beiden OAuth-Routen (connect/callback) leiten mit ?gscError=.../
 * ?gscConnected=1 hierher zurück, aber bisher las das nichts aus - ein
 * Verbindungsfehler verschwand einfach stillschweigend. Zeigt das jetzt als
 * Toast und räumt den Query-Parameter danach wieder aus der URL.
 */
export function GscConnectStatus() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("gscError");
    const connected = params.get("gscConnected");
    if (!error && !connected) return;

    if (error) toast.error(ERROR_MESSAGES[error] ?? "Verbindung zu Google Search Console fehlgeschlagen.");
    else if (connected) toast.success("Mit Google Search Console verbunden - bitte jetzt die Property auswählen.");

    params.delete("gscError");
    params.delete("gscConnected");
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, []);

  return null;
}
