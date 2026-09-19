/** B2B leads (Mandatsakquise) are named after the company once one is set; everyone else by person name. */
export function contactDisplayName(contact: {
  companyName?: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (contact.companyName) return contact.companyName;
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt";
}
