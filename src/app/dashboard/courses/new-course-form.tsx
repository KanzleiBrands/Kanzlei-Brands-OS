"use client";

import { useActionState } from "react";
import { createCourse } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };

export function NewCourseForm() {
  const [error, formAction, isPending] = useActionState(createCourse, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="title" placeholder="Kurstitel" required className="max-w-xs" />
      <Input name="description" placeholder="Beschreibung (optional)" className="max-w-sm" />
      <Select name="category" defaultValue="TRAINING">
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ONBOARDING">Onboarding</SelectItem>
          <SelectItem value="TRAINING">Training</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Kurs anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
