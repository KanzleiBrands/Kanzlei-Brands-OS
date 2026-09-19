"use client";

import { useState } from "react";
import { BanIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STAGE_COLOR_PALETTE } from "@/lib/stage-colors";

export type EditableStage = { name: string; color: string; isRejected?: boolean };

export function StageListEditor({
  initialStages,
  onChange,
}: {
  initialStages: EditableStage[];
  onChange: (stages: EditableStage[]) => void;
}) {
  const [stages, setStages] = useState<EditableStage[]>(initialStages);

  function update(next: EditableStage[]) {
    setStages(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        <BanIcon className="mr-1 inline size-3 align-[-1px]" />
        markiert eine Ausschluss-Stufe (z.B. Absage): erscheint nicht im Kanban, sondern im Reiter „Ausgeschlossen“.
      </p>
      {stages.map((stage, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="size-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <Input
            value={stage.name}
            placeholder="Status-Name"
            onChange={(e) => {
              const next = [...stages];
              next[index] = { ...next[index], name: e.target.value };
              update(next);
            }}
          />
          <div className="flex flex-shrink-0 gap-1">
            {STAGE_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Farbe ${color}`}
                className={`size-5 rounded-full ${stage.color === color ? "ring-2 ring-offset-1 ring-ring" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  const next = [...stages];
                  next[index] = { ...next[index], color };
                  update(next);
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant={stage.isRejected ? "default" : "ghost"}
            title="Als Ausschluss-Stufe markieren (z.B. Absage) - erscheint nicht im Kanban, sondern im Reiter „Ausgeschlossen“"
            aria-label="Als Ausschluss-Stufe markieren"
            onClick={() => {
              const next = [...stages];
              next[index] = { ...next[index], isRejected: !next[index].isRejected };
              update(next);
            }}
          >
            <BanIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={index === 0}
            onClick={() => {
              const next = [...stages];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              update(next);
            }}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={index === stages.length - 1}
            onClick={() => {
              const next = [...stages];
              [next[index + 1], next[index]] = [next[index], next[index + 1]];
              update(next);
            }}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={stages.length <= 1}
            onClick={() => update(stages.filter((_, i) => i !== index))}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update([...stages, { name: "", color: STAGE_COLOR_PALETTE[stages.length % STAGE_COLOR_PALETTE.length] }])}
      >
        <PlusIcon className="size-4" />
        Status hinzufügen
      </Button>
    </div>
  );
}
