"use client";

import { useTransition } from "react";
import { setRating } from "@/lib/actions/contacts";

export function StarRating({
  contactId,
  rating,
  size = "sm",
}: {
  contactId: string;
  rating: number | null;
  size?: "sm" | "default";
}) {
  const [isPending, startTransition] = useTransition();
  const current = rating ?? 0;
  const starClass = size === "sm" ? "size-3.5" : "size-5";

  function handleClick(e: React.MouseEvent, value: number) {
    e.preventDefault();
    e.stopPropagation();
    const formData = new FormData();
    formData.set("contactId", contactId);
    // Clicking the currently-set star clears the rating.
    formData.set("rating", String(value === current ? 0 : value));
    startTransition(() => {
      setRating(formData);
    });
  }

  return (
    <div className={`flex items-center gap-0.5 ${isPending ? "opacity-60" : ""}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={(e) => handleClick(e, value)}
          disabled={isPending}
          className="text-primary"
          aria-label={`${value} Sterne`}
        >
          <svg
            viewBox="0 0 20 20"
            fill={value <= current ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
            className={starClass}
          >
            <path d="M10 1.5l2.6 5.6 6 .8-4.4 4.3 1 6-5.2-2.9-5.2 2.9 1-6-4.4-4.3 6-.8L10 1.5z" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
