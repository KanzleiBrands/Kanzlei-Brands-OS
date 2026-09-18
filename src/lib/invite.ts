import crypto from "crypto";

const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateActivationToken() {
  return {
    token: crypto.randomBytes(24).toString("base64url"),
    expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
  };
}
