import { ContentConfigForm, type ContentIntentionValue } from "./content-config-form";
import { ContentReferenceDocsList, type ContentReferenceDocItem } from "./content-reference-docs-list";
import { SocialContentBookedToggle } from "@/app/dashboard/social-content/social-content-paywall";

/**
 * "Konfiguration"-Reiter des Content Boards (siehe content-tab.tsx) - alles
 * rund um die Firma, das in die KI-Ideen-Generierung einfließt oder als
 * Referenz dafür dient: Zielintention, Webseite + Marken-DNA, sowie eine
 * wachsende Liste von Referenzdokumenten (Onboarding/Briefing/Interview-
 * Transkripte). Dieser Reiter ist rein agenturseitig (diese Seite erreicht
 * ein Kunde nie, siehe page.tsx), deshalb lebt hier auch das "Für diesen
 * Kunden gebucht"-Freischalten für Social Media Content Management - NICHT
 * auf der kundenseitigen /dashboard/social-content, die das niemals zeigen
 * darf.
 */
export function ContentConfigPanel({
  organizationId,
  websiteUrl,
  brandDna,
  intention,
  referenceDocs,
  socialContentBooked,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
  intention: ContentIntentionValue | null;
  referenceDocs: ContentReferenceDocItem[];
  /** null im internen Marketing-Center, wo "für diesen Kunden gebucht" kein Konzept ist. */
  socialContentBooked: boolean | null;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {socialContentBooked !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Freischaltung</p>
          <SocialContentBookedToggle organizationId={organizationId} booked={socialContentBooked} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Firma</p>
        <ContentConfigForm
          organizationId={organizationId}
          websiteUrl={websiteUrl}
          brandDna={brandDna}
          intention={intention}
          showIntention={socialContentBooked !== null}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Referenzdokumente</p>
        <ContentReferenceDocsList organizationId={organizationId} docs={referenceDocs} />
      </div>
    </div>
  );
}
