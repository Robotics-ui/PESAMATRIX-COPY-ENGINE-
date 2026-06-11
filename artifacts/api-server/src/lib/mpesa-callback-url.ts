import { logger } from "./logger.js";

/**
 * Resolve the M-Pesa STK push callback URL.
 *
 * Priority order:
 *  1. MPESA_CALLBACK_URL env var (explicit override — use this in prod if needed)
 *  2. REPLIT_DOMAINS runtime var (set automatically on deployed Replit apps)
 *  3. REPLIT_DEV_DOMAIN runtime var (set in the Replit dev environment)
 *
 * Throws if none of the above is available.
 */
export function getMpesaCallbackUrl(): string {
  const explicit = process.env.MPESA_CALLBACK_URL;
  if (explicit) return explicit;

  const replitDomains = process.env.REPLIT_DOMAINS;
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const domain = replitDomains
    ? replitDomains.split(",")[0]?.trim()
    : replitDevDomain;

  if (domain) {
    const url = `https://${domain}/api/payments/mpesa/callback`;
    logger.info({ callbackUrl: url }, "[M-Pesa] Auto-resolved callback URL from Replit domain");
    return url;
  }

  throw new Error(
    "MPESA_CALLBACK_URL is not configured and no Replit domain is available. " +
    "Set MPESA_CALLBACK_URL to your public HTTPS callback endpoint.",
  );
}
