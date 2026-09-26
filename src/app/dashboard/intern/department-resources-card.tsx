"use client";

import { useActionState } from "react";
import { ExternalLinkIcon, TrashIcon } from "lucide-react";
import type { AgencyDepartment } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDepartmentResourceLink, deleteDepartmentResourceLink } from "@/lib/actions/department-hub";
import { useSaveToast } from "@/hooks/use-save-toast";

type ResourceLink = { id: string; label: string; url: string };

export function DepartmentResourcesCard({
  department,
  links,
  editable,
  bare = false,
}: {
  department: AgencyDepartment;
  links: ResourceLink[];
  editable: boolean;
  /** Ohne eigenen Card-Rahmen - für die Verwaltungsseite, die schon eine Card je Abteilung zeichnet. */
  bare?: boolean;
}) {
  if (!editable && links.length === 0) return null;

  const body = (
    <div className="flex flex-col gap-3">
      {links.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Links hinterlegt.</p>}
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-1">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}>
              {link.label}
              <ExternalLinkIcon className="size-3" />
            </Button>
            {editable && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteDepartmentResourceLink(link.id)}
                aria-label={`${link.label} entfernen`}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {editable && <AddResourceLinkForm department={department} />}
    </div>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Assets / Ressourcen</p>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets / Ressourcen</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function AddResourceLinkForm({ department }: { department: AgencyDepartment }) {
  const [error, formAction, isPending] = useActionState(addDepartmentResourceLink, undefined);
  useSaveToast(error, isPending);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3">
      <input type="hidden" name="department" value={department} />
      <Input name="label" placeholder="Bezeichnung" required className="h-8 w-40" />
      <Input name="url" type="url" placeholder="https://..." required className="h-8 flex-1 min-w-[10rem]" />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : "Hinzufügen"}
      </Button>
    </form>
  );
}
