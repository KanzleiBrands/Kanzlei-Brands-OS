type ContactWithEmailPhone = { id: string; email: string | null; phone: string | null };
type StageWithContacts = { contacts: ContactWithEmailPhone[] };

export type DuplicateContactKeys = { emails: Set<string>; phones: Set<string> };

function duplicatesOf(values: (string | null)[]): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    if (!raw) continue;
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [value, count] of counts) {
    if (count > 1) duplicates.add(value);
  }
  return duplicates;
}

/**
 * Returns the sets of lowercased emails/phone numbers that appear on more
 * than one contact within the same pipeline, so the UI can flag likely
 * duplicates - phone matters just as much as email for call-tracking leads
 * (matelso & co.), which usually have no email at all.
 */
export function findDuplicateContacts(stages: StageWithContacts[]): DuplicateContactKeys {
  const contacts = stages.flatMap((stage) => stage.contacts);
  return {
    emails: duplicatesOf(contacts.map((c) => c.email)),
    phones: duplicatesOf(contacts.map((c) => c.phone)),
  };
}

