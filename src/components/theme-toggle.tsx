"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

/** Whether we're past hydration - the real theme is only known client-side, so this guards against a mismatch without a setState-in-effect. */
function useHasMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Two explicit modes (no "system" option). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Zu hellem Modus wechseln" : "Zu dunklem Modus wechseln"}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      {isDark ? "Heller Modus" : "Dunkler Modus"}
    </Button>
  );
}
