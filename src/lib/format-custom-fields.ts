import { AUTO_DETECT, normalizeFieldKey, isTrackingKey } from "@/lib/webhook-ingest";

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
  const leaf = key.split(".").pop() ?? key;
  return SKIP_KEYS.has(normalizeFieldKey(leaf)) || isTrackingKey(leaf);
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
 * Same data as formatCustomFields, but keeps the raw key (a dot-path for a
 * nested webhook answer, e.g. "input.branche") so it can be fed straight
 * back into setValueAtPath/deleteValueAtPath - every entry is editable,
 * nested paths included (see those helpers for how a dotted key resolves).
 */
export function customFieldEntries(customFields: unknown): CustomFieldEntry[] {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return [];

  const flat = flatten(customFields as Record<string, unknown>);
  return Object.entries(flat)
    .filter(([key]) => !isSkipped(key))
    .map(([key, value]) => ({ key, label: humanizeKey(key), value, editable: true }));
}

/**
 * Immutably sets `value` at a dot-path within a (possibly nested)
 * customFields object, creating intermediate objects as needed - used so a
 * flat key like "Branche" and a nested webhook path like "input.branche"
 * are edited the same way.
 */
export function setValueAtPath(obj: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const keys = path.split(".");
  const result: Record<string, unknown> = { ...obj };
  let cursor = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const existing = cursor[key];
    const next: Record<string, unknown> =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    cursor[key] = next;
    cursor = next;
  }
  cursor[keys[keys.length - 1]] = value;
  return result;
}

/** Immutably removes whatever is at a dot-path within a customFields object. Leaves it unchanged if the path doesn't resolve. */
export function deleteValueAtPath(obj: Record<string, unknown>, path: string): Record<string, unknown> {
  const keys = path.split(".");
  if (keys.length === 1) {
    const result = { ...obj };
    delete result[keys[0]];
    return result;
  }
  const [head, ...rest] = keys;
  const child = obj[head];
  if (!child || typeof child !== "object" || Array.isArray(child)) return obj;
  return { ...obj, [head]: deleteValueAtPath(child as Record<string, unknown>, rest.join(".")) };
}
