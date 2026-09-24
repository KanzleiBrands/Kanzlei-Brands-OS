"use client";

import { useActionState, useMemo, useState } from "react";
import type { SystemEmailType } from "@prisma/client";
import { SendIcon } from "lucide-react";
import { updateSystemEmailTemplate, sendTestSystemEmail } from "@/lib/actions/system-email-templates";
import { renderBrandedEmail } from "@/lib/email/template";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

export type SystemEmailTemplateData = {
  type: SystemEmailType;
  label: string;
  description: string;
  placeholders: { token: string; description: string }[];
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  footerNote: string;
};

const SAMPLE_VARS: Record<string, string> = { name: "Lukas", kampagne: "Beispiel-Kampagne" };

function substitute(text: string) {
  let result = text;
  for (const [key, value] of Object.entries(SAMPLE_VARS)) result = result.replaceAll(`{{${key}}}`, value);
  return result;
}

function EmailTemplateEditor({ template, baseUrl }: { template: SystemEmailTemplateData; baseUrl: string }) {
  const [subject, setSubject] = useState(template.subject);
  const [heading, setHeading] = useState(template.heading);
  const [body, setBody] = useState(template.body);
  const [ctaLabel, setCtaLabel] = useState(template.ctaLabel);
  const [footerNote, setFooterNote] = useState(template.footerNote);

  const [saveError, saveAction, isSaving] = useActionState(updateSystemEmailTemplate, undefined);
  useSaveToast(saveError, isSaving, "E-Mail-Vorlage gespeichert.");
  const [testError, testAction, isTesting] = useActionState(sendTestSystemEmail, undefined);
  useSaveToast(testError, isTesting, "Test-Mail gesendet - schau in dein Postfach.");

  const previewHtml = useMemo(
    () =>
      renderBrandedEmail({
        baseUrl,
        preheader: substitute(subject),
        heading: substitute(heading),
        paragraphs: [substitute(body)],
        ctaLabel,
        ctaUrl: baseUrl,
        footerNote: footerNote ? substitute(footerNote) : undefined,
      }).html,
    [baseUrl, subject, heading, body, ctaLabel, footerNote],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{template.label}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form action={saveAction} className="flex flex-col gap-3">
            <input type="hidden" name="type" value={template.type} />

            <label className="flex flex-col gap-1 text-sm font-medium">
              Betreff
              <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Überschrift
              <Input name="heading" value={heading} onChange={(e) => setHeading(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Text
              <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Button-Text
              <Input name="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fußnotiz (optional)
              <Input name="footerNote" value={footerNote} onChange={(e) => setFooterNote(e.target.value)} />
            </label>

            <p className="text-xs text-muted-foreground">
              Platzhalter:{" "}
              {template.placeholders.map((p) => (
                <code key={p.token} className="mr-1.5 rounded bg-muted px-1 py-0.5" title={p.description}>
                  {p.token}
                </code>
              ))}
            </p>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            {testError && <p className="text-sm text-destructive">{testError}</p>}

            <div className="mt-1 flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Wird gespeichert..." : "Speichern"}
              </Button>
              <Button type="submit" formAction={testAction} variant="outline" disabled={isTesting}>
                <SendIcon className="size-4" />
                {isTesting ? "Wird gesendet..." : "Test-Mail an mich senden"}
              </Button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border">
            <iframe
              key={template.type}
              srcDoc={previewHtml}
              title={`Vorschau: ${template.label}`}
              sandbox=""
              className="h-[520px] w-full bg-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailCenterSection({ templates, baseUrl }: { templates: SystemEmailTemplateData[]; baseUrl: string }) {
  const [selectedType, setSelectedType] = useState<SystemEmailType>(templates[0]?.type);
  const selected = templates.find((t) => t.type === selectedType) ?? templates[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Inhalt und Vorschau der automatisch versendeten E-Mails. Das Design (Logo, Farben, Button) ist einheitlich
        und wird hier nicht verändert - nur Betreff, Text und Button-Beschriftung.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {templates.map((t) => (
          <Button
            key={t.type}
            type="button"
            size="sm"
            variant={t.type === selected?.type ? "default" : "outline"}
            onClick={() => setSelectedType(t.type)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {selected && <EmailTemplateEditor key={selected.type} template={selected} baseUrl={baseUrl} />}
    </div>
  );
}
