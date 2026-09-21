"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "lucide-react";
import { updateHubSettings } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import { APPLICANT_GROWTH_LEVERS, LEAD_GROWTH_LEVERS } from "@/lib/growth-levers";
import { useSaveToast } from "@/hooks/use-save-toast";

// A real (visually hidden) checkbox input next to a styled indicator, so the
// browser's native multi-value form submission (name + value per checked
// box) still works when this is submitted as part of the surrounding
// <form action> - unlike the reusable Checkbox component, this list needs a
// distinct `value` per option, which that component's underlying primitive
// doesn't support.
function CheckboxTile({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "flex size-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-input bg-background",
        )}
      >
        {checked && <CheckIcon className="size-3 text-primary-foreground" strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

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
        <CheckboxTile
          key={option.tag}
          name={name}
          value={option.tag}
          checked={checked.has(option.tag)}
          onChange={(isChecked) => {
            const next = new Set(checked);
            if (isChecked) next.add(option.tag);
            else next.delete(option.tag);
            setChecked(next);
          }}
        >
          {option.label}
        </CheckboxTile>
      ))}
    </div>
  );
}

export function HubSettingsForm({
  organizationId,
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
}: {
  organizationId: string;
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
}) {
  const [error, formAction, isPending] = useActionState(updateHubSettings, undefined);
  useSaveToast(error, isPending);
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
              <CheckboxTile
                key={tag}
                name="bookedProductTags"
                value={tag}
                checked={checkedTags.has(tag)}
                onChange={(isChecked) => {
                  const next = new Set(checkedTags);
                  if (isChecked) next.add(tag);
                  else next.delete(tag);
                  setCheckedTags(next);
                }}
              >
                {tag}
              </CheckboxTile>
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
