type FieldMapping = Record<string, string>;

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const AUTO_DETECT: Record<string, string[]> = {
  firstName: ["firstName", "first_name", "vorname", "firstname"],
  lastName: ["lastName", "last_name", "nachname", "lastname"],
  email: ["email", "e_mail", "mail"],
  phone: ["phone", "telefon", "phone_number", "tel"],
};

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/**
 * Maps an arbitrary inbound JSON payload (OnePage, Perspektive, Zapier, ...) onto
 * Contact fields. Explicit `fieldMapping` entries (dot-path -> Contact field) win;
 * anything not mapped falls back to common key auto-detection, and the full raw
 * payload is always preserved in customFields for later reference.
 */
export function extractContactFields(payload: Record<string, unknown>, fieldMapping?: FieldMapping | null) {
  const result: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null } = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
  };

  if (fieldMapping) {
    for (const [contactField, path] of Object.entries(fieldMapping)) {
      if (contactField in result) {
        (result as Record<string, string | null>)[contactField] = toStringOrNull(getByPath(payload, path));
      }
    }
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
