/**
 * B2B leads (Mandatsakquise) are named after the company once one is set;
 * everyone else by person name. A call-tracking lead (matelso & co.) often
 * has neither - falls back to the phone number so the card is still
 * actionable, and only to "Unbenannt" when there's truly nothing at all.
 */
export function contactDisplayName(contact: {
  companyName?: string | null;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
}): string {
  if (contact.companyName) return contact.companyName;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return name || contact.phone || "Unbenannt";
}
