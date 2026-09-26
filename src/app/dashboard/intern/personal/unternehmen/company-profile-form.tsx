"use client";

import { useActionState } from "react";
import { updateCompanyProfile } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

type Organization = {
  name: string;
  companyWebsite: string | null;
  businessNumber: string | null;
  vatId: string | null;
  foundedYear: number | null;
  mission: string | null;
};

export function CompanyProfileForm({ organization }: { organization: Organization }) {
  const [error, formAction, isPending] = useActionState(updateCompanyProfile, undefined);
  useSaveToast(error, isPending, "Unternehmensdaten gespeichert.");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Firmenname</Label>
        <Input id="name" name="name" defaultValue={organization.name} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyWebsite">Webseite</Label>
        <Input id="companyWebsite" name="companyWebsite" type="url" defaultValue={organization.companyWebsite ?? ""} placeholder="https://..." />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessNumber">Betriebsnummer</Label>
        <Input id="businessNumber" name="businessNumber" defaultValue={organization.businessNumber ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vatId">Umsatzsteuer-ID</Label>
        <Input id="vatId" name="vatId" defaultValue={organization.vatId ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="foundedYear">Gründungsjahr</Label>
        <Input id="foundedYear" name="foundedYear" type="number" defaultValue={organization.foundedYear ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="mission">Mission</Label>
        <Textarea id="mission" name="mission" defaultValue={organization.mission ?? ""} placeholder="Wofür steht Kanzlei Brands?" />
      </div>

      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-fit sm:col-span-2">
        {isPending ? "Wird gespeichert..." : "Speichern"}
      </Button>
    </form>
  );
}
