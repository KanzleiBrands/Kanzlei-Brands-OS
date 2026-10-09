import { ContentConfigForm, type ContentIntentionValue } from "./content-config-form";
import { ContentReferenceDocsList, type ContentReferenceDocItem } from "./content-reference-docs-list";
import { ContentReferenceAccountsList, type ContentReferenceAccountItem } from "./content-reference-accounts-list";
import { MediaLibraryList, type MediaLibraryItemData } from "./media-library-list";
import { ContentSnippetsList, type ContentSnippetItem } from "./content-snippets-list";
import { ApprovalReminderToggle } from "./approval-reminder-toggle";
import { SocialContentBookedToggle } from "@/app/dashboard/social-content/social-content-paywall";
import { CallTranscriptSyncPanel } from "./call-transcript-sync-panel";

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
  referenceAccounts,
  mediaLibraryItems,
  contentSnippets,
  socialContentBooked,
  socialApprovalReminderEnabled,
  callTranscriptSync,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
  intention: ContentIntentionValue | null;
  referenceDocs: ContentReferenceDocItem[];
  referenceAccounts: ContentReferenceAccountItem[];
  mediaLibraryItems: MediaLibraryItemData[];
  contentSnippets: ContentSnippetItem[];
  /** null im internen Marketing-Center, wo "für diesen Kunden gebucht" kein Konzept ist. */
  socialContentBooked: boolean | null;
  /** null im internen Marketing-Center, wo es keine echten Kunden-Nutzer zum Erinnern gibt. */
  socialApprovalReminderEnabled: boolean | null;
  /** null für echte Kunden - die Call-Transkript-Syncs sind agentur-weit, nie pro Kunde sichtbar. */
  callTranscriptSync: {
    fireflies: { enabled: boolean; lastSyncedAt: string | null; lastSyncError: string | null };
    close: { enabled: boolean; lastSyncedAt: string | null; lastSyncError: string | null };
    transcriptCount: number;
  } | null;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {socialContentBooked !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Freischaltung</p>
          <SocialContentBookedToggle organizationId={organizationId} booked={socialContentBooked} />
        </div>
      )}

      {socialApprovalReminderEnabled !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Freigabe-Reminder</p>
          <ApprovalReminderToggle organizationId={organizationId} enabled={socialApprovalReminderEnabled} />
        </div>
      )}

      {callTranscriptSync && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Call-Transkripte</p>
          <CallTranscriptSyncPanel
            fireflies={callTranscriptSync.fireflies}
            close={callTranscriptSync.close}
            transcriptCount={callTranscriptSync.transcriptCount}
          />
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

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Referenz-Accounts</p>
        <ContentReferenceAccountsList organizationId={organizationId} accounts={referenceAccounts} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Bilder-Bibliothek</p>
        <MediaLibraryList organizationId={organizationId} items={mediaLibraryItems} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Textbausteine</p>
        <ContentSnippetsList organizationId={organizationId} snippets={contentSnippets} />
      </div>
    </div>
  );
}
