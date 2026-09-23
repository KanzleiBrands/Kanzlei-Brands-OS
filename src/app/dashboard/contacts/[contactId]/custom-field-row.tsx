"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FileTextIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { setCustomField, deleteCustomField } from "@/lib/actions/contacts";
import { isFileUrl } from "@/lib/format-custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function CustomFieldRow({
  contactId,
  fieldKey,
  label,
  value,
  editable,
}: {
  contactId: string;
  fieldKey: string;
  label: string;
  value: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(setCustomField, undefined);
  useSaveToast(error, isPending);
  const wasPending = useRef(false);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleDelete() {
    if (!window.confirm(`"${label}" wirklich löschen?`)) return;
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("key", fieldKey);
    startDelete(() => {
      deleteCustomField(formData);
    });
  }

  if (!editing) {
    return (
      <div className="contents">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="flex min-w-0 items-center gap-2">
          {isFileUrl(value) ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary underline"
            >
              <FileTextIcon className="size-3.5" />
              Datei öffnen
            </a>
          ) : (
            <span className="min-w-0 break-words">{value}</span>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`${label} bearbeiten`}
              className="text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={`${label} löschen`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </dd>
      </div>
    );
  }

  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="key" value={fieldKey} />
          <Input key={value} name="value" defaultValue={value} autoFocus className="max-w-xs" />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "..." : "Speichern"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </dd>
    </div>
  );
}
