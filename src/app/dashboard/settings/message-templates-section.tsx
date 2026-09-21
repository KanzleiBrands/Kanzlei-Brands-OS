"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createTemplate, deleteTemplate, setTemplateDefaultForKind } from "@/lib/actions/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveToast } from "@/hooks/use-save-toast";
import { toast } from "sonner";

type Template = {
  id: string;
  kind: "NOTE" | "EMAIL";
  name: string;
  subject: string | null;
  body: string;
  defaultForKind: "LEADS" | "APPLICANTS" | null;
};

const KIND_LABELS: Record<Template["kind"], string> = { NOTE: "Notiz", EMAIL: "E-Mail" };

function NewTemplateForm() {
  const [error, formAction, isPending] = useActionState(createTemplate, undefined);
  useSaveToast(error, isPending, "Vorlage angelegt.");
  const [kind, setKind] = useState<Template["kind"]>("NOTE");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={kind === "NOTE" ? "default" : "outline"} onClick={() => setKind("NOTE")}>
          Notiz-Vorlage
        </Button>
        <Button type="button" size="sm" variant={kind === "EMAIL" ? "default" : "outline"} onClick={() => setKind("EMAIL")}>
          E-Mail-Vorlage
        </Button>
      </div>
      <Input name="name" placeholder="Name (z.B. Einladung zum Vorstellungsgespräch)" required />
      {kind === "EMAIL" && <Input name="subject" placeholder="Betreff" />}
      <Textarea name="body" placeholder="Text..." required rows={4} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Anlegen..." : "Vorlage anlegen"}
      </Button>
    </form>
  );
}

function DefaultForKindCheckbox({
  templateId,
  kind,
  label,
  checked,
}: {
  templateId: string;
  kind: "LEADS" | "APPLICANTS";
  label: string;
  checked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Checkbox
        defaultChecked={checked}
        disabled={isPending}
        onCheckedChange={(nextChecked) => {
          const formData = new FormData();
          formData.set("templateId", templateId);
          formData.set("defaultForKind", kind);
          formData.set("checked", String(nextChecked));
          startTransition(async () => {
            try {
              await setTemplateDefaultForKind(formData);
              toast.success("Gespeichert.");
            } catch {
              toast.error("Konnte nicht gespeichert werden.");
            }
          });
        }}
      />
      {label}
    </label>
  );
}

export function MessageTemplatesSection({ templates }: { templates: Template[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Textbausteine</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Wiederverwendbare Notiz- und E-Mail-Vorlagen, einmal anlegen und in jedem Kontakt per Klick einfügen. Eine
          E-Mail-Vorlage kann außerdem als automatische Empfangsbestätigung markiert werden, die neue Leads/Bewerber
          direkt bei Eingang bekommen (höchstens eine pro Kampagnentyp).
        </p>
        <NewTemplateForm />
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <div key={template.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{KIND_LABELS[template.kind]}</Badge>
                  <p className="font-medium">{template.name}</p>
                </div>
                {template.subject && <p className="text-sm text-muted-foreground">Betreff: {template.subject}</p>}
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.body}</p>
                {template.kind === "EMAIL" && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <DefaultForKindCheckbox
                      templateId={template.id}
                      kind="APPLICANTS"
                      label="Standard bei neuer Bewerbung"
                      checked={template.defaultForKind === "APPLICANTS"}
                    />
                    <DefaultForKindCheckbox
                      templateId={template.id}
                      kind="LEADS"
                      label="Standard bei neuer Mandatsanfrage"
                      checked={template.defaultForKind === "LEADS"}
                    />
                  </div>
                )}
              </div>
              <form action={deleteTemplate}>
                <input type="hidden" name="templateId" value={template.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Löschen
                </Button>
              </form>
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Textbausteine angelegt.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
