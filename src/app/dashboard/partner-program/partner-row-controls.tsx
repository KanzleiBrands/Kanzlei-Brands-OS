"use client";

import { useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "lucide-react";
import {
  togglePartnerActionActive,
  movePartnerAction,
  deletePartnerAction,
  togglePartnerRewardActive,
  movePartnerReward,
  deletePartnerReward,
} from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";

type Kind = "action" | "reward";

const IDS: Record<Kind, string> = { action: "actionId", reward: "rewardId" };
const TOGGLE = { action: togglePartnerActionActive, reward: togglePartnerRewardActive };
const MOVE = { action: movePartnerAction, reward: movePartnerReward };
const DELETE = { action: deletePartnerAction, reward: deletePartnerReward };

export function PartnerActiveToggle({ kind, id, active }: { kind: Kind; id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set(IDS[kind], id);
        startTransition(() => {
          TOGGLE[kind](formData);
        });
      }}
    >
      {active ? "Aktiv" : "Inaktiv"}
    </Button>
  );
}

export function PartnerMoveButtons({ kind, id, isFirst, isLast }: { kind: Kind; id: string; isFirst: boolean; isLast: boolean }) {
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const formData = new FormData();
    formData.set(IDS[kind], id);
    formData.set("direction", direction);
    startTransition(() => {
      MOVE[kind](formData);
    });
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label="Nach oben"
        disabled={isPending || isFirst}
        onClick={() => move("up")}
        className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ArrowUpIcon className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Nach unten"
        disabled={isPending || isLast}
        onClick={() => move("down")}
        className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ArrowDownIcon className="size-3.5" />
      </button>
    </div>
  );
}

export function PartnerDeleteButton({ kind, id, title }: { kind: Kind; id: string; title: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Löschen"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`"${title}" wirklich löschen?`)) return;
        const formData = new FormData();
        formData.set(IDS[kind], id);
        startTransition(() => {
          DELETE[kind](formData);
        });
      }}
      className="flex size-8 items-center justify-center text-muted-foreground hover:text-destructive"
    >
      <TrashIcon className="size-4" />
    </button>
  );
}
