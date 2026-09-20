/**
 * Deal volumes are entered as whole Euros (no Cents), so any "." or ","
 * typed - whether meant as a thousands separator (German "3.000") or a
 * stray decimal point - is stripped rather than interpreted, which is what
 * previously turned an intended 3000 into 3 via a plain `Number("3.000")`.
 */
export function parseEuroAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}
