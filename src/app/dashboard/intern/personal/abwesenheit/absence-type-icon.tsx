import * as LucideIcons from "lucide-react";
import { CalendarDaysIcon, type LucideIcon } from "lucide-react";
import { absenceColorHex } from "@/lib/absence-colors";

const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

export function AbsenceTypeIcon({ icon, color, className = "size-4" }: { icon: string; color: string; className?: string }) {
  const Icon = Icons[icon] ?? CalendarDaysIcon;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full p-1.5"
      style={{ backgroundColor: `${absenceColorHex(color)}1a`, color: absenceColorHex(color) }}
    >
      <Icon className={className} />
    </span>
  );
}
