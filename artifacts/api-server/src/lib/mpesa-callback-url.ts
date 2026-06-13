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
  const raw = process.env.MPESA_CALLBACK_URL;

  if (raw) {
    // Strip surrounding quotes and whitespace that may have been added when
    // entering the secret value (e.g.  "https://..."  or 'https://...' ).
    const sanitized = raw
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!sanitized.startsWith("https://")) {
      logger.error(
        { raw: `${sanitized.slice(0, 40)}…`, hint: "MPESA_CALLBACK_URL must start with https://" },
        "[M-Pesa] ⚠️  Invalid MPESA_CALLBACK_URL — must be an HTTPS URL",
      );
      throw new Error(
        `MPESA_CALLBACK_URL is not a valid HTTPS URL: "${sanitized.slice(0, 60)}". ` +
        "Ensure the secret is set to a plain https:// URL with no surrounding quotes.",
      );
    }

    logger.info({ callbackUrl: sanitized }, "[M-Pesa] Callback URL resolved from MPESA_CALLBACK_URL secret");
    return sanitized;
  }

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
