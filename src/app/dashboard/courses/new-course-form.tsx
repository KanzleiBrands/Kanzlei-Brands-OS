"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createCourse } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };

export function NewCourseForm() {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createCourse, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        <PlusIcon className="size-4" />
        Kurs anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kurs anlegen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Input name="title" placeholder="Kurstitel" required />
          <Input name="description" placeholder="Beschreibung (optional)" />
          <Select name="category" defaultValue="TRAINING">
            <SelectTrigger>
              <SelectValue>{(value: string) => LABELS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONBOARDING">Onboarding</SelectItem>
              <SelectItem value="TRAINING">Training</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Kurs anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
