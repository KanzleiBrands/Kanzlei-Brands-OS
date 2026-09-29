/**
 * Contacts are imported from various sources (CSV, webhooks, manual entry)
 * and end up with inconsistent phone formats - some with a leading "+49",
 * some with "0049", some in domestic "0..." form, and some (from a bad
 * import) with the country code concatenated directly in front of the
 * domestic form including its leading trunk "0" (e.g. "49" + "0533..."),
 * which is not a valid E.164 number. Both helpers below normalize to the
 * same "+49..." shape first, so the visible number and the tel: link
 * always agree - without this, an OS phone-number parser seeing a bare
 * digit string with no "+" (and matching the device's own country) can
 * prepend its own guessed country code on top of an already-present one,
 * which is why "Anrufen" was dialing a doubled +49.
 */
function toE164(raw: string): string | null {
  let digits = raw.trim();
  if (!digits) return null;

  if (digits.startsWith("+")) {
    digits = digits.slice(1).replace(/\D/g, "");
  } else {
    digits = digits.replace(/\D/g, "");
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("0")) {
      // Domestic format without a country code - assume Germany.
      digits = `49${digits.slice(1)}`;
    }
  }
  if (!digits) return null;

  // "49" immediately followed by another "0" is always the domestic trunk
  // prefix that should have been dropped when the country code was added
  // (no real German area/mobile code starts with 0) - strip it.
  if (digits.startsWith("490")) {
    digits = `49${digits.slice(3)}`;
  }

  return `+${digits}`;
}

/** tel: target for a stored phone number - always a clean "+49..." so no OS dialer re-guesses a country code. */
export function telHref(raw: string): string {
  return `tel:${toE164(raw) ?? raw}`;
}

/**
 * Human-readable "+49 5339459775"-style display for a stored phone number.
 * German area/mobile codes have no fixed length, so splitting the rest into
 * area code + subscriber number without a full prefix database would just
 * be a guess - only the (unambiguous, 2-digit) German country code is split
 * off. Non-German numbers are shown as a plain E.164 string.
 */
export function formatPhoneDisplay(raw: string): string {
  const e164 = toE164(raw);
  if (!e164) return raw;
  return e164.startsWith("+49") ? `+49 ${e164.slice(3)}` : e164;
}
