"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Fires a brief green/red popup whenever a useActionState result settles
// (isPending flips from true to false), covering both existing return
// conventions in this codebase: a plain error string (undefined = success),
// and a { status, message } result object.
type ToastableResult = { status: "success" | "error"; message: string } | string | undefined | null;

export function useSaveToast(
  result: ToastableResult,
  isPending: boolean,
  successMessage = "Gespeichert.",
) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      if (typeof result === "string") {
        if (result) toast.error(result);
      } else if (result && typeof result === "object") {
        if (result.status === "success") toast.success(result.message);
        else toast.error(result.message);
      } else {
        toast.success(successMessage);
      }
    }
    wasPending.current = isPending;
  }, [isPending, result, successMessage]);
}
