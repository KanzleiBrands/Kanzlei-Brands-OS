// Shared between server actions and client-side upload forms, so it has no
// server-only dependencies (unlike file-storage.ts, which a client
// component must never import from).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
