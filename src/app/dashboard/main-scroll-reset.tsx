"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Next's built-in scroll restoration only resets `window` scroll. Our
// dashboard content scrolls inside <main id="dashboard-main"> instead (so the
// sidebar can stay put), which Next never touches - so navigating away from a
// deeply-scrolled page left the next page's <main> starting at that same
// scrollTop, showing blank space until the user scrolled back up themselves.
export function MainScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    document.getElementById("dashboard-main")?.scrollTo(0, 0);
  }, [pathname, searchParams]);

  return null;
}
