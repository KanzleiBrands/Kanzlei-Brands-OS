"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";

/**
 * Below `md`, the sidebar is an off-canvas drawer (hidden by default, opened
 * via a hamburger button) instead of a permanent flex column - on a phone
 * viewport a fixed 224px-wide sidebar left no room at all for the actual
 * page content. Auto-closes on navigation since Links inside `sidebar` are
 * a server-rendered subtree we don't control click handlers on individually.
 */
export function MobileSidebarShell({ sidebar }: { sidebar: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Adjusting state during render (not in an effect) on a prop change, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menü öffnen"
          className="text-muted-foreground hover:text-foreground"
        >
          <MenuIcon className="size-6" />
        </button>
        <Image src="/brand/mark.jpg" alt="Kanzlei Brands" width={28} height={28} className="rounded" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r bg-card p-4 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:w-56 md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Menü schließen"
          className="mb-4 self-end text-muted-foreground hover:text-foreground md:hidden"
        >
          <XIcon className="size-5" />
        </button>
        {sidebar}
      </aside>
    </>
  );
}
