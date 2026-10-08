import { ContentConfigForm, type ContentIntentionValue } from "./content-config-form";
import { ContentReferenceDocsList, type ContentReferenceDocItem } from "./content-reference-docs-list";

/**
 * "Konfiguration"-Reiter des Content Boards (siehe content-tab.tsx) - alles
 * rund um die Firma, das in die KI-Ideen-Generierung einfließt oder als
 * Referenz dafür dient: Zielintention, Webseite + Marken-DNA, sowie eine
 * wachsende Liste von Referenzdokumenten (Onboarding/Briefing/Interview-
 * Transkripte).
 */
export function ContentConfigPanel({
  organizationId,
  websiteUrl,
  brandDna,
  intention,
  referenceDocs,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
  intention: ContentIntentionValue | null;
  referenceDocs: ContentReferenceDocItem[];
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Firma</p>
        <ContentConfigForm organizationId={organizationId} websiteUrl={websiteUrl} brandDna={brandDna} intention={intention} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Referenzdokumente</p>
        <ContentReferenceDocsList organizationId={organizationId} docs={referenceDocs} />
      </div>
    </div>
  );
}
