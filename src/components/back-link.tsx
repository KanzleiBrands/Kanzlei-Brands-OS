import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4 flex-shrink-0" />
      {children}
    </Link>
  );
}
