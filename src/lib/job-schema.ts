// schema.org/JobPosting-Hilfsfunktionen für die öffentliche Stellenanzeige-
// Seite (/jobs/[pipelineId]). Das ist der nachhaltigste Vertriebsweg: Google
// for Jobs indexiert reine Strukturdaten auf einer öffentlichen Seite, ganz
// ohne Account oder Feed - unabhängig davon, was Indeed und Co. an ihren
// Feed-Regeln ändern (siehe Indeeds "Single-Source Feed Policy", die
// klassische XML-Feeds ab 31.03.2026 schrittweise abschafft).
export type EmploymentType = {
  value: string; // schema.org EmploymentType-Wert
  label: string;
};

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  { value: "FULL_TIME", label: "Vollzeit" },
  { value: "PART_TIME", label: "Teilzeit" },
  { value: "CONTRACTOR", label: "Freelance / Werkvertrag" },
  { value: "TEMPORARY", label: "Befristet" },
  { value: "INTERN", label: "Praktikum / Ausbildung" },
];

export function employmentTypeLabel(value: string | null): string {
  return EMPLOYMENT_TYPES.find((t) => t.value === value)?.label ?? "Vollzeit";
}

export type JobPostingSchemaInput = {
  title: string;
  descriptionHtml: string;
  datePosted: Date;
  validThrough: Date | null;
  employmentType: string | null;
  employerName: string;
  employerLogoUrl: string | null;
  employerWebsite: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  applicationUrl: string;
};

export function buildJobPostingJsonLd(input: JobPostingSchemaInput) {
  const hasStructuredAddress = Boolean(input.city);

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: input.title,
    description: input.descriptionHtml,
    datePosted: input.datePosted.toISOString(),
    ...(input.validThrough ? { validThrough: input.validThrough.toISOString() } : {}),
    employmentType: input.employmentType ?? "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: input.employerName,
      ...(input.employerLogoUrl ? { logo: input.employerLogoUrl } : {}),
      ...(input.employerWebsite ? { sameAs: input.employerWebsite } : {}),
    },
    jobLocation: hasStructuredAddress
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            ...(input.street ? { streetAddress: input.street } : {}),
            ...(input.postalCode ? { postalCode: input.postalCode } : {}),
            addressLocality: input.city,
            addressCountry: input.country ?? "DE",
          },
        }
      : undefined,
    jobLocationType: hasStructuredAddress ? undefined : "TELECOMMUTE",
    applicantLocationRequirements: hasStructuredAddress
      ? undefined
      : { "@type": "Country", name: input.country ?? "DE" },
    directApply: true,
    url: input.applicationUrl,
  };
}
