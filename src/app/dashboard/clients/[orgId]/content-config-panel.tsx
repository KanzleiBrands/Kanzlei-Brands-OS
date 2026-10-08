import { ContentConfigForm } from "./content-config-form";
import { ContentReferenceDocsList, type ContentReferenceDocItem } from "./content-reference-docs-list";

function zielintentionLabel(jobsBooked: boolean, leadsBooked: boolean): string {
  if (jobsBooked && leadsBooked) return "Recruiting & Mandatsakquise";
  if (jobsBooked) return "Recruiting";
  if (leadsBooked) return "Mandatsakquise";
  return "Noch keine Kampagne gebucht";
}

/**
 * "Konfiguration"-Reiter des Content Boards (siehe content-tab.tsx) - alles
 * rund um die Firma, das in die KI-Ideen-Generierung einfließt oder als
 * Referenz dafür dient: Zielintention (aus den gebuchten Kampagnen
 * abgeleitet), Webseite + Marken-DNA, sowie eine wachsende Liste von
 * Referenzdokumenten (Onboarding/Briefing/Interview-Transkripte).
 */
export function ContentConfigPanel({
  organizationId,
  websiteUrl,
  brandDna,
  referenceDocs,
  clientContext,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
  referenceDocs: ContentReferenceDocItem[];
  /** null im internen Marketing-Center, wo Recruiting/Mandatsakquise-Buchungen kein Konzept sind. */
  clientContext: { jobsBooked: boolean; leadsBooked: boolean } | null;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {clientContext && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Zielintention</p>
          <p className="text-sm text-muted-foreground">{zielintentionLabel(clientContext.jobsBooked, clientContext.leadsBooked)}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Firma</p>
        <ContentConfigForm organizationId={organizationId} websiteUrl={websiteUrl} brandDna={brandDna} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Referenzdokumente</p>
        <ContentReferenceDocsList organizationId={organizationId} docs={referenceDocs} />
      </div>
    </div>
  );
}
