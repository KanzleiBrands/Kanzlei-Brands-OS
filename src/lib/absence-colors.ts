/** Farbtoken (frei vom Admin vergeben, z.B. beim Anlegen einer Abwesenheitsart) -> Hex fürs Icon-Badge. */
const ABSENCE_COLOR_HEX: Record<string, string> = {
  blue: "#3B82F6",
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  pink: "#EC4899",
  green: "#22C55E",
  purple: "#8B5CF6",
  teal: "#14B8A6",
};

export function absenceColorHex(color: string): string {
  return ABSENCE_COLOR_HEX[color] ?? "#6B7280";
}

export const ABSENCE_COLOR_OPTIONS = Object.keys(ABSENCE_COLOR_HEX);
