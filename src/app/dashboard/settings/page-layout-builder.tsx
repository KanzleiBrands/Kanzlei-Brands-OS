"use client";

import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, GripVerticalIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { savePageLayout } from "@/lib/actions/page-layout";
import { Button } from "@/components/ui/button";
import { useSaveToast } from "@/hooks/use-save-toast";

export type LayoutBlock = { key: string; label: string; enabled: boolean };
type PageKey = "OVERVIEW" | "HUB";

function SortableRow({
  block,
  onToggle,
}: {
  block: LayoutBlock;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-2 rounded-xl border bg-card p-3 ${!block.enabled ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        aria-label="Verschieben"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <p className="min-w-0 flex-1 text-sm">{block.label}</p>
      <button
        type="button"
        aria-label={block.enabled ? "Modul ausblenden" : "Modul einblenden"}
        onClick={onToggle}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {block.enabled ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
      </button>
    </div>
  );
}

function PageLayoutForm({ page, initialBlocks }: { page: PageKey; initialBlocks: LayoutBlock[] }) {
  const [error, formAction, isPending] = useActionState(savePageLayout, undefined);
  useSaveToast(error, isPending, "Layout gespeichert.");
  const [blocks, setBlocks] = useState<LayoutBlock[]>(initialBlocks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((b) => {
      const oldIndex = b.findIndex((blk) => blk.key === active.id);
      const newIndex = b.findIndex((blk) => blk.key === over.id);
      return arrayMove(b, oldIndex, newIndex);
    });
  }

  function toggleBlock(key: string) {
    setBlocks((b) => b.map((blk) => (blk.key === key ? { ...blk, enabled: !blk.enabled } : blk)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks.map((b) => ({ key: b.key, enabled: b.enabled })))} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {blocks.map((block) => (
              <SortableRow key={block.key} block={block} onToggle={() => toggleBlock(block.key)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

export function PageLayoutBuilder({
  overview,
  hub,
}: {
  overview: LayoutBlock[];
  hub: LayoutBlock[];
}) {
  const [page, setPage] = useState<PageKey>("OVERVIEW");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Seiten-Layout</h2>
        <p className="text-sm text-muted-foreground">
          Module per Drag-Handle umsortieren oder aus-/einblenden - gilt für alle Kunden.
        </p>
      </div>

      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant={page === "OVERVIEW" ? "default" : "outline"} onClick={() => setPage("OVERVIEW")}>
          Übersicht
        </Button>
        <Button type="button" size="sm" variant={page === "HUB" ? "default" : "outline"} onClick={() => setPage("HUB")}>
          Kunden-Hub
        </Button>
      </div>

      {page === "OVERVIEW" && <PageLayoutForm key="OVERVIEW" page="OVERVIEW" initialBlocks={overview} />}
      {page === "HUB" && <PageLayoutForm key="HUB" page="HUB" initialBlocks={hub} />}
    </div>
  );
}
