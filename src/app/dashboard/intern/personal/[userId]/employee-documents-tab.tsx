"use client";

import { useActionState, useState } from "react";
import { FileTextIcon, TrashIcon } from "lucide-react";
import { uploadEmployeeDocument, deleteEmployeeDocument } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveToast } from "@/hooks/use-save-toast";

type Doc = {
  id: string;
  title: string;
  fileUrl: string;
  description: string | null;
  documentDate: string | null;
  category: "CONTRACT" | "CERTIFICATE" | "OTHER";
};

const CATEGORY_LABELS: Record<Doc["category"], string> = {
  CONTRACT: "Verträge",
  CERTIFICATE: "Zertifikate",
  OTHER: "Andere Dokumente",
};

export function EmployeeDocumentsTab({ userId, documents, editable }: { userId: string; documents: Doc[]; editable: boolean }) {
  const [activeCategory, setActiveCategory] = useState<Doc["category"]>("CONTRACT");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-foreground/10">
        {(Object.keys(CATEGORY_LABELS) as Doc["category"][]).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-2 text-sm transition-colors ${
              activeCategory === category
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {documents
          .filter((doc) => doc.category === activeCategory)
          .map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3 text-sm">
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{doc.title}</span>
              </a>
              <div className="flex shrink-0 items-center gap-3">
                {doc.description && <span className="text-xs text-muted-foreground">{doc.description}</span>}
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteEmployeeDocument(doc.id)}
                    aria-label={`${doc.title} löschen`}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        {documents.filter((doc) => doc.category === activeCategory).length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Dokumente in dieser Kategorie.</p>
        )}
      </div>

      {editable && <UploadForm userId={userId} category={activeCategory} />}
    </div>
  );
}

function UploadForm({ userId, category }: { userId: string; category: Doc["category"] }) {
  const [error, formAction, isPending] = useActionState(uploadEmployeeDocument, undefined);
  useSaveToast(error, isPending, "Dokument hochgeladen.");

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/15 p-3" encType="multipart/form-data">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="category" value={category} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input name="title" placeholder="Titel, z.B. Arbeitsvertrag" required />
        <Input name="description" placeholder="Beschreibung (optional)" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Vertragsdatum (optional)</Label>
          <Input name="documentDate" type="date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Datei (PDF, max. 5 MB)</Label>
          <Input name="file" type="file" accept=".pdf,application/pdf" required />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Wird hochgeladen..." : "Dokument hinzufügen"}
      </Button>
    </form>
  );
}
