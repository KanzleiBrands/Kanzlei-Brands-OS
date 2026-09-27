export type EnvStatus = { label: string; connected: boolean; missing: string[] };

/** Prüft, ob alle genannten Env-Vars gesetzt sind - für Integrations-Status-Anzeigen (kein Geheimnis wird zurückgegeben, nur ob gesetzt). */
export function checkEnvStatus(label: string, vars: string[]): EnvStatus {
  const missing = vars.filter((v) => !process.env[v]);
  return { label, connected: missing.length === 0, missing };
}
