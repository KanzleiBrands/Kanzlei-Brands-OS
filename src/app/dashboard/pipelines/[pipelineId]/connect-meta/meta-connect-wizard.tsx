"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { listMetaLeadFormsForPage, finalizeMetaConnection } from "@/lib/actions/meta-integration";

type Page = { id: string; name: string };
type Form = { id: string; name: string };

export function MetaConnectWizard({ pipelineId, pages }: { pipelineId: string; pages: Page[] }) {
  const router = useRouter();
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [forms, setForms] = useState<Form[] | null>(null);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectPage(page: Page) {
    setSelectedPage(page);
    setForms(null);
    setSelectedForm(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await listMetaLeadFormsForPage(pipelineId, page.id);
        setForms(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Formulare konnten nicht geladen werden.");
      }
    });
  }

  function handleConfirm() {
    if (!selectedPage || !selectedForm) return;
    setError(null);
    startTransition(async () => {
      try {
        await finalizeMetaConnection(pipelineId, selectedPage.id, selectedForm.id, selectedForm.name);
        router.push(`/dashboard/pipelines/${pipelineId}?tab=sources&metaConnected=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verbindung konnte nicht gespeichert werden.");
      }
    });
  }

  if (pages.length === 0) {
    return (
      <p className="text-muted-foreground">
        Keine Facebook-Seiten gefunden, für die du Admin-Rechte hast. Bitte in Facebook prüfen und erneut versuchen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">1. Facebook-Seite</p>
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <Button
              key={page.id}
              type="button"
              variant={selectedPage?.id === page.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelectPage(page)}
            >
              {page.name}
            </Button>
          ))}
        </div>
      </div>

      {selectedPage && (
        <div>
          <p className="mb-2 text-sm font-medium">2. Lead-Formular</p>
          {forms === null && isPending && <p className="text-sm text-muted-foreground">Lade Formulare...</p>}
          {forms !== null && forms.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Diese Seite hat noch keine Instant-Formulare im Meta Ads Manager.
            </p>
          )}
          {forms !== null && forms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {forms.map((form) => (
                <Button
                  key={form.id}
                  type="button"
                  variant={selectedForm?.id === form.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedForm(form)}
                >
                  {form.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" disabled={!selectedForm || isPending} onClick={handleConfirm} className="self-start">
        {isPending ? "Verbinde..." : "Verbinden"}
      </Button>
    </div>
  );
}
