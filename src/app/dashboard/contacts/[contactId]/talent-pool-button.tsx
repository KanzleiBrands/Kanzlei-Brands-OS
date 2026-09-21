"use client";

import { useState } from "react";
import Link from "next/link";
import { StarIcon } from "lucide-react";
import { setTalentPool } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Pool = { id: string; name: string };

export function TalentPoolButton({
  contactId,
  talentPool,
  talentPoolNote,
  availablePools,
}: {
  contactId: string;
  talentPool: Pool | null;
  talentPoolNote: string | null;
  availablePools: Pool[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string>("");
  const [newPoolName, setNewPoolName] = useState("");

  if (talentPool) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/talentpool">
          <Badge variant="secondary" className="gap-1">
            <StarIcon className="size-3" />
            {talentPool.name}
          </Badge>
        </Link>
        {talentPoolNote && <span className="text-sm text-muted-foreground">{talentPoolNote}</span>}
        <form action={setTalentPool}>
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="enabled" value="false" />
          <Button type="submit" size="sm" variant="ghost">
            Aus Talentpool entfernen
          </Button>
        </form>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelectedPoolId("");
          setNewPoolName("");
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <StarIcon className="size-4" />
        Zum Talentpool hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Zum Talentpool hinzufügen</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await setTalentPool(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="enabled" value="true" />
          <p className="text-sm text-muted-foreground">
            Passt aktuell nicht, ist aber grundsätzlich interessant? Wir legen automatisch eine Wiedervorlage in ca.
            6 Monaten an, um noch mal nachzufassen.
          </p>

          {availablePools.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">Pool</label>
              <Select
                value={selectedPoolId}
                onValueChange={(value) => {
                  setSelectedPoolId(value ?? "");
                  if (value) setNewPoolName("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => availablePools.find((p) => p.id === value)?.name ?? "Neuen Pool anlegen"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availablePools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="poolId" value={selectedPoolId} />
            </div>
          )}

          {!selectedPoolId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">
                {availablePools.length > 0 ? "...oder neuen Pool anlegen" : "Pool-Name"}
              </label>
              <Input
                name="newPoolName"
                placeholder="z.B. Steuerfachangestellte, Quereinsteiger"
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
                required={availablePools.length === 0}
              />
            </div>
          )}

          <Textarea name="note" placeholder="Notiz (optional), z.B. wofür der Kandidat gut passen könnte" />
          <Button type="submit" disabled={!selectedPoolId && !newPoolName.trim()}>
            Hinzufügen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
