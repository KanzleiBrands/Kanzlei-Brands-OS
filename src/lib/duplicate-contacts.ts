type ContactWithEmail = { id: string; email: string | null };
type StageWithContacts = { contacts: ContactWithEmail[] };

// Returns the set of lowercased emails that appear on more than one contact
// within the same pipeline, so the UI can flag likely duplicate leads.
export function findDuplicateEmails(stages: StageWithContacts[]): Set<string> {
  const counts = new Map<string, number>();

  for (const stage of stages) {
    for (const contact of stage.contacts) {
      if (!contact.email) continue;
      const email = contact.email.trim().toLowerCase();
      if (!email) continue;
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
  }

  const duplicates = new Set<string>();
  for (const [email, count] of counts) {
    if (count > 1) duplicates.add(email);
  }
  return duplicates;
}
