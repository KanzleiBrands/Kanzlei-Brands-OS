"use client";

import { useActionState, useState } from "react";
import { updateHubSettings } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLICANT_GROWTH_LEVERS, LEAD_GROWTH_LEVERS } from "@/lib/growth-levers";

type AgencyUser = { id: string; name: string };

function ChannelCheckboxList({
  name,
  options,
  initialChecked,
}: {
  name: string;
  options: { tag: string; label: string }[];
  initialChecked: string[];
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label key={option.tag} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name={name}
            value={option.tag}
            checked={checked.has(option.tag)}
            onChange={(e) => {
              const next = new Set(checked);
              if (e.target.checked) next.add(option.tag);
              else next.delete(option.tag);
              setChecked(next);
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function HubSettingsForm({
  organizationId,
  backofficeContactId,
  driveFolderUrl,
  landingPageUrl,
  metaAdLibraryUrl,
  linkedInAdLibraryUrl,
  bookedProductTags,
  availableProductTags,
  activeApplicantChannels,
  activeLeadChannels,
  jobsBooked,
  leadsBooked,
  agencyUsers,
}: {
  organizationId: string;
  backofficeContactId: string | null;
  driveFolderUrl: string | null;
  landingPageUrl: string | null;
  metaAdLibraryUrl: string | null;
  linkedInAdLibraryUrl: string | null;
  bookedProductTags: string[];
  availableProductTags: string[];
  activeApplicantChannels: string[];
  activeLeadChannels: string[];
  jobsBooked: boolean;
  leadsBooked: boolean;
  agencyUsers: AgencyUser[];
}) {
  const [error, formAction, isPending] = useActionState(updateHubSettings, undefined);
  const [checkedTags, setCheckedTags] = useState<Set<string>>(new Set(bookedProductTags));
  const applicantChannelOptions = APPLICANT_GROWTH_LEVERS.filter((l) => l.kind === "channel").map((l) => ({
    tag: l.tag,
    label: l.label,
  }));
  const leadChannelOptions = LEAD_GROWTH_LEVERS.filter((l) => l.kind === "channel").map((l) => ({
    tag: l.tag,
    label: l.label,
  }));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="flex flex-col gap-1.5">
        <Label>Buchhaltung / Backoffice-Ansprechpartner</Label>
        <Select name="backofficeContactId" defaultValue={backofficeContactId ?? ""}>
          <SelectTrigger className="max-w-64">
            <SelectValue>
              {(value: string) => agencyUsers.find((u) => u.id === value)?.name ?? "Nicht zugewiesen"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {agencyUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Wird im Kunden-Hub für Fragen zu Rechnungen/Vertragswesen angezeigt. Telefon/Calendly pflegt diese Person
          selbst unter Einstellungen → Account.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="driveFolderUrl">Google-Drive-Ordner</Label>
        <Input
          id="driveFolderUrl"
          name="driveFolderUrl"
          type="url"
          placeholder="https://drive.google.com/drive/folders/..."
          defaultValue={driveFolderUrl ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="landingPageUrl">Landingpage</Label>
        <Input
          id="landingPageUrl"
          name="landingPageUrl"
          type="url"
          placeholder="https://..."
          defaultValue={landingPageUrl ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="metaAdLibraryUrl">Meta-Werbebibliothek</Label>
        <Input
          id="metaAdLibraryUrl"
          name="metaAdLibraryUrl"
          type="url"
          placeholder="https://www.facebook.com/ads/library/..."
          defaultValue={metaAdLibraryUrl ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="linkedInAdLibraryUrl">LinkedIn-Werbebibliothek</Label>
        <Input
          id="linkedInAdLibraryUrl"
          name="linkedInAdLibraryUrl"
          type="url"
          placeholder="https://www.linkedin.com/ad-library/..."
          defaultValue={linkedInAdLibraryUrl ?? ""}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Jeder Link erscheint im Kunden-Hub nur, wenn er hier gesetzt ist - so sieht der Kunde nie einen leeren Link zu
        etwas, das er gar nicht gebucht hat.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label>Bereits gebuchte Produkte</Label>
        <p className="text-sm text-muted-foreground">
          Angebote mit passendem Tag werden diesem Kunden im Kunden-Hub nicht mehr als Upsell vorgeschlagen (siehe
          Angebote-Verwaltung, Feld &bdquo;Produkt-Tag&ldquo;).
        </p>
        {availableProductTags.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {availableProductTags.map((tag) => (
              <label key={tag} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="bookedProductTags"
                  value={tag}
                  checked={checkedTags.has(tag)}
                  onChange={(e) => {
                    const next = new Set(checkedTags);
                    if (e.target.checked) next.add(tag);
                    else next.delete(tag);
                    setCheckedTags(next);
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Angebote mit Produkt-Tag angelegt (siehe Angebote-Verwaltung).
          </p>
        )}
      </div>

      {(jobsBooked || leadsBooked) && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <div>
            <Label>Potenzialscore</Label>
            <p className="text-sm text-muted-foreground">
              Welche Kanäle nutzt dieser Kunde für seine gebuchte Kampagne aktuell tatsächlich? Nicht angehakte
              Kanäle senken den Potenzialscore im Kunden-Hub und werden dem Kunden dort als konkrete
              Handlungsempfehlung angezeigt (inkl. Hinweis, das mit dem Account Manager zu besprechen).
            </p>
          </div>

          {jobsBooked && (
            <div className="flex flex-col gap-1.5">
              <Label>Aktive Recruiting-Kanäle</Label>
              <ChannelCheckboxList
                name="activeApplicantChannels"
                options={applicantChannelOptions}
                initialChecked={activeApplicantChannels}
              />
            </div>
          )}

          {leadsBooked && (
            <div className="flex flex-col gap-1.5">
              <Label>Aktive Mandatsakquise-Kanäle</Label>
              <ChannelCheckboxList
                name="activeLeadChannels"
                options={leadChannelOptions}
                initialChecked={activeLeadChannels}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
    </form>
  );
}
