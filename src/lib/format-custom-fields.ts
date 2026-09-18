const SKIP_KEYS = new Set([
  "email",
  "firstName",
  "first_name",
  "lastName",
  "last_name",
  "phone",
  "name",
  "full_name",
  "location",
  "ort",
  "stadt",
  "city",
  "wohnort",
]);

function humanizeKey(key: string): string {
  return key
    .replace(/[_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map((v) => String(v)).join(", ");
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

/** Turns the raw webhook payload into a readable label/value list, skipping fields already shown as structured Contact columns. */
export function formatCustomFields(customFields: unknown): { label: string; value: string }[] {
  if (!customFields || typeof customFields !== "object") return [];

  const flat = flatten(customFields as Record<string, unknown>);
  return Object.entries(flat)
    .filter(([key]) => !SKIP_KEYS.has(key.split(".").pop() ?? key))
    .map(([key, value]) => ({ label: humanizeKey(key), value }));
}
