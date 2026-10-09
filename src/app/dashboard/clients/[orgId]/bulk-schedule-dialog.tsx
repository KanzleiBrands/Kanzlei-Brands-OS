"use client";

import { useState, useTransition } from "react";
import { CalendarClockIcon } from "lucide-react";
import { bulkSchedulePosts } from "@/lib/actions/social-posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { useSaveToast } from "@/hooks/use-save-toast";

export type BulkSchedulablePost = { id: string; platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; caption: string };

function localDateAtTime(date: Date, timeOfDay: string): string {
  const [hour, minute] = timeOfDay.split(":").map(Number);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Bulk-Terminplanung: mehrere produktionsbereite Beiträge (Status IN_PRODUCTION
 * mit bereits fertigem Text) auf einen Rutsch verteilen, statt jeden einzeln
 * manuell zu terminieren - Startdatum + Rhythmus in Tagen + feste Uhrzeit,
 * ein Termin pro ausgewähltem Beitrag in der angezeigten Reihenfolge.
 */
export function BulkScheduleDialog({ organizationId, posts }: { organizationId: string; posts: BulkSchedulablePost[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [intervalDays, setIntervalDays] = useState(2);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  useSaveToast(error, isPending, "Beiträge eingeplant.");

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit() {
    setError(undefined);
    if (selected.length === 0 || !startDate) {
      setError("Bitte Beiträge und ein Startdatum auswählen.");
      return;
    }
    const [year, month, day] = startDate.split("-").map(Number);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    selected.forEach((id, i) => {
      const date = new Date(year, month - 1, day + i * intervalDays);
      fd.append("postIds", id);
      fd.append("scheduledAts", localDateAtTime(date, timeOfDay));
    });
    startTransition(async () => {
      const result = await bulkSchedulePosts(fd);
      if (result) {
        setError(result);
      } else {
        setOpen(false);
        setSelected([]);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <CalendarClockIcon className="size-4" />
        Bulk-Terminplanung
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mehrere Beiträge auf einen Rutsch planen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Verteilt die ausgewählten Beiträge beginnend ab dem Startdatum im gewählten Rhythmus - der erste ausgewählte
            Beitrag bekommt das Startdatum, jeder weitere folgt im Abstand.
          </p>

          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine produktionsbereiten Beiträge (In Produktion, mit Text) vorhanden.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border p-1.5">
              {posts.map((post) => (
                <label key={post.id} className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={selected.includes(post.id)} onCheckedChange={() => toggle(post.id)} />
                  <PlatformIcon platform={post.platform} className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{post.caption || "(ohne Text)"}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="bulk-schedule-start">Startdatum</Label>
              <Input id="bulk-schedule-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <Label htmlFor="bulk-schedule-time">Uhrzeit</Label>
              <Input id="bulk-schedule-time" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
            </div>
            <div className="flex w-28 flex-col gap-1">
              <Label htmlFor="bulk-schedule-interval">Rhythmus (Tage)</Label>
              <Input
                id="bulk-schedule-interval"
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" disabled={isPending || selected.length === 0} onClick={handleSubmit}>
            {isPending ? "Wird eingeplant..." : `${selected.length || ""} Beitrag/Beiträge einplanen`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
