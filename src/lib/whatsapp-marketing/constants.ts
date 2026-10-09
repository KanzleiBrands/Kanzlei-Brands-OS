// Shared between the "use server" actions file, the server page, and the
// client tab component - kept in its own plain module because a "use
// server" file may only export async functions, not plain constants.
// Mirrors src/lib/funnels/constants.ts (E-Mail Marketing).
export const WHATSAPP_MARKETING_PRODUCT_TAG = "whatsapp_marketing";
export const WHATSAPP_RECRUITING_PRODUCT_TAG = "whatsapp_recruiting";
export const WHATSAPP_ADDON_PRICE_LABEL = "69 € / Monat";
