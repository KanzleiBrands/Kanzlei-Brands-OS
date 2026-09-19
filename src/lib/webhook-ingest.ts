type FieldMapping = Record<string, string>;

/** Lowercases and replaces whitespace/hyphens with underscores, so "E-Mail" and "e_mail" are recognized as the same key. */
export function normalizeFieldKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export const AUTO_DETECT: Record<string, string[]> = {
  firstName: ["firstName", "first_name", "vorname", "firstname"],
  lastName: ["lastName", "last_name", "nachname", "lastname"],
  email: ["email", "e_mail", "mail"],
  phone: ["phone", "telefon", "phone_number", "tel"],
  location: ["location", "ort", "stadt", "city", "wohnort"],
  cvUrl: ["cv_url", "cvurl", "lebenslauf", "resume_url", "resume", "cv"],
  companyName: ["company", "company_name", "companyname", "firma", "firmenname", "unternehmen"],
  address: ["address", "adresse", "strasse", "street", "anschrift"],
};

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EMAIL_HINT = /e-?mail/i;
const PHONE_HINT = /telefon|phone|handy|mobil/i;
const CV_HINT = /lebenslauf|resume|\bcv\b/i;
const COMPANY_HINT = /firma|firmenname|unternehmen|company/i;
const COMBINED_NAME_HINT = /vor.*nach|nach.*vor|full[\s_-]?name/i;
const FIRST_NAME_HINT = /vorname|first[\s_-]?name/i;
const LAST_NAME_HINT = /nachname|last[\s_-]?name|surname/i;
const NAME_HINT = /name/i;

/**
 * Recursively collects `{ title, value }` leaf pairs from a nested object,
 * e.g. `{ input: { ch1aim: { title, value } } }` -> one entry for "ch1aim"
 * (slug "input.ch1aim"). A node is a leaf as soon as it has its own `value`
 * key; anything without one is a grouping object to recurse into.
 */
function collectTitledEntries(node: unknown, path: string[] = []): { slug: string; title: string; value: string }[] {
  if (!isPlainObject(node)) return [];
  if ("value" in node) {
    const value = toStringOrNull(node.value);
    if (!value) return [];
    return [{ slug: path.join("."), title: toStringOrNull(node.title) ?? path.join(" "), value }];
  }
  return Object.entries(node).flatMap(([key, child]) => collectTitledEntries(child, [...path, key]));
}

/**
 * Some funnel builders (e.g. Perspektive) submit every answer as a
 * `{ title, value }` pair nested under a `profile` object, keyed by an
 * opaque, per-funnel field id (e.g. "file-87adc40beb..."). The human-readable
 * `title` is the only reliable signal for what a field actually is - the key
 * itself is arbitrary and regenerated per funnel, so it can't be matched
 * against AUTO_DETECT. This walks that shape once, recognizes the fields we
 * already show as structured columns (name/email/phone/CV) by matching on
 * the title, and turns everything else into a clean question -> answer map
 * instead of the raw payload, which also repeats every answer under
 * separate "titles"/"values"/tracking-metadata trees.
 */
function extractFromTitledProfile(profile: Record<string, unknown>): {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  cvUrl: string | null;
  companyName: string | null;
  customFields: Record<string, string>;
} | null {
  const entries = collectTitledEntries(profile);
  if (entries.length === 0) return null;

  let firstName: string | null = null;
  let lastName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let cvUrl: string | null = null;
  let companyName: string | null = null;
  const customFields: Record<string, string> = {};

  for (const entry of entries) {
    const haystack = `${entry.slug} ${entry.title}`;
    if (!email && EMAIL_HINT.test(haystack)) {
      email = entry.value;
    } else if (!phone && PHONE_HINT.test(haystack)) {
      phone = entry.value;
    } else if (!cvUrl && CV_HINT.test(haystack)) {
      cvUrl = entry.value;
    } else if (!companyName && COMPANY_HINT.test(haystack)) {
      companyName = entry.value;
    } else if (!firstName && !lastName && COMBINED_NAME_HINT.test(haystack)) {
      const [first, ...rest] = entry.value.split(" ");
      firstName = first || null;
      lastName = rest.join(" ") || null;
    } else if (!firstName && FIRST_NAME_HINT.test(haystack) && !LAST_NAME_HINT.test(haystack)) {
      firstName = entry.value;
    } else if (!lastName && LAST_NAME_HINT.test(haystack)) {
      lastName = entry.value;
    } else if (!firstName && !lastName && NAME_HINT.test(haystack)) {
      const [first, ...rest] = entry.value.split(" ");
      firstName = first || null;
      lastName = rest.join(" ") || null;
    } else {
      customFields[entry.title] = entry.value;
    }
  }

  return { firstName, lastName, email, phone, cvUrl, companyName, customFields };
}

/** Pulls a display string out of a fieldsMap entry, which can be a plain value or an option object like `{ label, value }`. */
function valueFromFieldsMapEntry(raw: unknown): string | null {
  const plain = toStringOrNull(raw);
  if (plain) return plain;
  if (Array.isArray(raw)) {
    const parts = raw.map((item) => valueFromFieldsMapEntry(item)).filter((v): v is string => !!v);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (isPlainObject(raw)) {
    for (const key of ["label", "text", "name", "value"]) {
      const value = toStringOrNull(raw[key]);
      if (value) return value;
    }
  }
  return null;
}

/** Strips OnePage's step-number prefix and control-type suffix, e.g. "Step 7. Frage 5: Umsatz -> Select" -> "Frage 5: Umsatz". */
function cleanFieldsMapLabel(key: string): string {
  return key
    .replace(/^Step\s*\d+\.\s*/i, "")
    .replace(/\s*->\s*(Select|Text|Input)$/i, "")
    .trim();
}

/**
 * OnePage submits a `data.fieldsMap` object keyed by a step/question label
 * (e.g. "Step 1. Optin -> E-Mail"), with option-type answers ("Select")
 * shaped as `{ label, value }` objects rather than plain strings. Treated
 * the same way as Perspektive's `profile`: this is the canonical per-field
 * answer set, so it replaces the raw payload (which also separately ships
 * a redundant "leadInfo" summary string and internal tracking metadata like
 * form/site/page ids) instead of being merged with it.
 */
function extractFromFieldsMap(fieldsMap: Record<string, unknown>): {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  customFields: Record<string, string>;
} | null {
  const entries = Object.entries(fieldsMap)
    .map(([key, raw]) => ({ label: cleanFieldsMapLabel(key), value: valueFromFieldsMapEntry(raw) }))
    .filter((entry): entry is { label: string; value: string } => !!entry.value);
  if (entries.length === 0) return null;

  let firstName: string | null = null;
  let lastName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let companyName: string | null = null;
  const customFields: Record<string, string> = {};

  for (const entry of entries) {
    const haystack = entry.label;
    if (!email && EMAIL_HINT.test(haystack)) {
      email = entry.value;
    } else if (!phone && PHONE_HINT.test(haystack)) {
      phone = entry.value;
    } else if (!companyName && COMPANY_HINT.test(haystack)) {
      companyName = entry.value;
    } else if (!firstName && !lastName && COMBINED_NAME_HINT.test(haystack)) {
      const [first, ...rest] = entry.value.split(" ");
      firstName = first || null;
      lastName = rest.join(" ") || null;
    } else if (!firstName && FIRST_NAME_HINT.test(haystack) && !LAST_NAME_HINT.test(haystack)) {
      firstName = entry.value;
    } else if (!lastName && LAST_NAME_HINT.test(haystack)) {
      lastName = entry.value;
    } else if (!firstName && !lastName && NAME_HINT.test(haystack)) {
      const [first, ...rest] = entry.value.split(" ");
      firstName = first || null;
      lastName = rest.join(" ") || null;
    } else {
      customFields[entry.label] = entry.value;
    }
  }

  return { firstName, lastName, email, phone, companyName, customFields };
}

/**
 * Maps an arbitrary inbound JSON payload (OnePage, Perspektive, Zapier, ...) onto
 * Contact fields. Explicit `fieldMapping` entries (dot-path -> Contact field) win;
 * anything not mapped falls back to common key auto-detection. `customFields` is
 * null unless a cleaner, derived answer set (see extractFromTitledProfile) should
 * replace the raw payload - otherwise the caller keeps storing the raw payload.
 */
export function extractContactFields(payload: Record<string, unknown>, fieldMapping?: FieldMapping | null) {
  const result: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    cvUrl: string | null;
    companyName: string | null;
    address: string | null;
    customFields: Record<string, string> | null;
  } = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    location: null,
    cvUrl: null,
    companyName: null,
    address: null,
    customFields: null,
  };

  if (fieldMapping) {
    for (const [contactField, path] of Object.entries(fieldMapping)) {
      if (contactField in result) {
        (result as Record<string, string | null>)[contactField] = toStringOrNull(getByPath(payload, path));
      }
    }
  }

  const titledProfile = isPlainObject(payload.profile) ? extractFromTitledProfile(payload.profile) : null;
  if (titledProfile) {
    for (const field of ["firstName", "lastName", "email", "phone", "cvUrl", "companyName"] as const) {
      if (!result[field]) result[field] = titledProfile[field];
    }
    result.customFields = titledProfile.customFields;
  }

  const onePageFieldsMap =
    isPlainObject(payload.data) && isPlainObject(payload.data.fieldsMap) ? payload.data.fieldsMap : null;
  const fromFieldsMap = onePageFieldsMap ? extractFromFieldsMap(onePageFieldsMap) : null;
  if (fromFieldsMap) {
    for (const field of ["firstName", "lastName", "email", "phone", "companyName"] as const) {
      if (!result[field]) result[field] = fromFieldsMap[field];
    }
    result.customFields = fromFieldsMap.customFields;
  }

  for (const [field, candidates] of Object.entries(AUTO_DETECT)) {
    if ((result as Record<string, string | null>)[field]) continue;
    for (const candidate of candidates) {
      const value = toStringOrNull(payload[candidate]);
      if (value) {
        (result as Record<string, string | null>)[field] = value;
        break;
      }
    }
  }

  // Split a combined "name" field if first/last name weren't found individually.
  if (!result.firstName && !result.lastName) {
    const fullName = toStringOrNull(payload.name ?? payload.full_name);
    if (fullName) {
      const [first, ...rest] = fullName.split(" ");
      result.firstName = first;
      result.lastName = rest.join(" ") || null;
    }
  }

  return result;
}

/** Recursively collects every string/number/boolean leaf value in a payload, for loose text matching. */
function collectAllValues(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined) return out;
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    out.push(String(node));
  } else if (Array.isArray(node)) {
    for (const item of node) collectAllValues(item, out);
  } else if (isPlainObject(node)) {
    for (const value of Object.values(node)) collectAllValues(value, out);
  }
  return out;
}

/**
 * For a job posted at several locations sharing one funnel/webhook: finds
 * which location answer (if any) appears anywhere in the payload and
 * returns the Pipeline id it should route to, per the endpoint's configured
 * `locationRouting` map (location text -> pipeline id). Returns null when
 * nothing matches, so the caller falls back to the endpoint's own pipeline.
 */
export function resolveLocationRoutingPipelineId(
  payload: Record<string, unknown>,
  routing: Record<string, string> | null | undefined,
): string | null {
  if (!routing) return null;
  const entries = Object.entries(routing).filter(([location]) => location.trim());
  if (entries.length === 0) return null;

  const values = new Set(collectAllValues(payload).map((v) => v.trim().toLowerCase()));
  for (const [location, pipelineId] of entries) {
    if (values.has(location.trim().toLowerCase())) return pipelineId;
  }
  return null;
}
