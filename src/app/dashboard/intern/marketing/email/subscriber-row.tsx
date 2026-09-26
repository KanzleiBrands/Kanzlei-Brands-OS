"use client";

import { useState, useTransition } from "react";
import { XIcon, Trash2Icon } from "lucide-react";
import {
  addSubscriberTag,
  removeSubscriberTag,
  suppressSubscriber,
  reactivateSubscriber,
  deleteSubscriber,
} from "@/lib/actions/marketing-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { absenceColorHex } from "@/lib/absence-colors";

type Subscriber = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "ACTIVE" | "SUPPRESSED";
  suppressedReason: string | null;
  tags: { id: string; name: string; color: string }[];
};

export function SubscriberRow({
  subscriber,
  allTags,
  canManage,
}: {
  subscriber: Subscriber;
  allTags: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [pickingTag, setPickingTag] = useState(false);
  const name = [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ");
  const availableTags = allTags.filter((t) => !subscriber.tags.some((st) => st.id === t.id));

  function run(action: (formData: FormData) => Promise<void> | void, fields: Record<string, string>) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    startTransition(() => {
      action(fd);
    });
  }

  function handleAddTag(tagId: string) {
    const fd = new FormData();
    fd.set("subscriberId", subscriber.id);
    fd.set("tagId", tagId);
    startTransition(async () => {
      const error = await addSubscriberTag(undefined, fd);
      if (error) window.alert(error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name || subscriber.email}</p>
        {name && <p className="truncate text-xs text-muted-foreground">{subscriber.email}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {subscriber.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: absenceColorHex(tag.color) }} />
            {tag.name}
            {canManage && (
              <button
                type="button"
                aria-label={`Tag ${tag.name} entfernen`}
                disabled={isPending}
                onClick={() => run(removeSubscriberTag, { subscriberId: subscriber.id, tagId: tag.id })}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        {canManage && availableTags.length > 0 && (
          <Select
            open={pickingTag}
            onOpenChange={setPickingTag}
            onValueChange={(value: string | null) => {
              if (value) handleAddTag(value);
              setPickingTag(false);
            }}
          >
            <SelectTrigger className="h-6 rounded-full border-dashed px-2 text-xs">
              <SelectValue>{() => "+ Tag"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableTags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Badge variant={subscriber.status === "ACTIVE" ? "default" : "outline"}>
        {subscriber.status === "ACTIVE" ? "Aktiv" : `Fallout${subscriber.suppressedReason === "calendly_booking" ? " (Termin gebucht)" : ""}`}
      </Badge>

      {canManage && (
        <div className="flex items-center gap-1">
          {subscriber.status === "ACTIVE" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(suppressSubscriber, { subscriberId: subscriber.id })}
            >
              Fallout
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(reactivateSubscriber, { subscriberId: subscriber.id })}
            >
              Reaktivieren
            </Button>
          )}
          <button
            type="button"
            aria-label="Kontakt löschen"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Kontakt wirklich löschen?")) return;
              run(deleteSubscriber, { subscriberId: subscriber.id });
            }}
            className="flex size-7 items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
