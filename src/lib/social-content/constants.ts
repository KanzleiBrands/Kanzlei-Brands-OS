// Shared between the "use server" actions file and the server pages/client
// components - kept in its own plain module because a "use server" file may
// only export async functions, not plain constants (see src/lib/funnels/constants.ts
// for the same pattern used by the E-Mail-Marketing paywall).
export const SOCIAL_CONTENT_PRODUCT_TAG = "social_content_management";
export const SOCIAL_CONTENT_PRICE_LABEL = "ab 850 € netto / Monat";
