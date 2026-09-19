import { AUTO_DETECT, normalizeFieldKey } from "@/lib/webhook-ingest";

// Mirrors the synonym lists used to extract structured Contact columns from a
// raw payload/CSV row (webhook-ingest.ts), so anything already shown as
// firstName/lastName/email/phone/location up top never also appears as a
// separate, disconnected "custom field" below.
const SKIP_KEYS = new Set([...Object.values(AUTO_DETECT).flat().map(normalizeFieldKey), "name", "full_name"]);

function humanizeKey(key: string): string {
  // Already a readable, flat label/question (e.g. from extractFromTitledProfile
  // or extractFromFieldsMap) - leave casing alone. Only flat (non-dotted) keys
  // qualify: a nested raw-payload path whose leaf segment happens to contain a
  // space would otherwise be returned as the raw dotted path unhumanized.
  if (!key.includes(".") && key.includes(" ")) return key.trim();

  return key
    .replace(/[_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** True if a custom-field value is a link to an uploaded file (CV, photo, ...) rather than plain text. */
export function isFileUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  return /filename=|\/(download|uploads?|files?)\//i.test(value) || /\.(pdf|docx?|jpe?g|png|gif|webp|heic)(\?|$)/i.test(value);
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = value
        .map((v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)))
        .join(", ");
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function isSkipped(key: string): boolean {
  return SKIP_KEYS.has(normalizeFieldKey(key.split(".").pop() ?? key));
}

/** Turns the raw webhook payload into a readable label/value list, skipping fields already shown as structured Contact columns. */
export function formatCustomFields(customFields: unknown): { label: string; value: string }[] {
  if (!customFields || typeof customFields !== "object") return [];

  const flat = flatten(customFields as Record<string, unknown>);
  return Object.entries(flat)
    .filter(([key]) => !isSkipped(key))
    .map(([key, value]) => ({ label: humanizeKey(key), value }));
}

export type CustomFieldEntry = { key: string; label: string; value: string; editable: boolean };

/**
 * Same data as formatCustomFields, but keeps the raw top-level key and marks
 * whether it's directly editable (only flat, top-level keys are — nested
 * form answers stay read-only to keep the edit UI simple).
 */
export function customFieldEntries(customFields: unknown): CustomFieldEntry[] {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return [];

  const flat = flatten(customFields as Record<string, unknown>);
  return Object.entries(flat)
    .filter(([key]) => !isSkipped(key))
    .map(([key, value]) => ({ key, label: humanizeKey(key), value, editable: !key.includes(".") }));
}
