"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTalentPool } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusIcon } from "lucide-react";

export function NewTalentPoolForm() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Pool anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Talentpool anlegen</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createTalentPool(formData);
            toast.success("Pool angelegt.");
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <Input name="name" placeholder="z.B. Steuerfachangestellte" required autoFocus />
          <Button type="submit">Anlegen</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
