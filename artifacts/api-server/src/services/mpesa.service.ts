import { logger } from "../lib/logger.js";

type MpesaEnv = "production" | "sandbox";

const DARAJA_URLS: Record<MpesaEnv, { base: string }> = {
  production: { base: "https://api.safaricom.co.ke" },
  sandbox: { base: "https://sandbox.safaricom.co.ke" },
};

export interface StkPushParams {
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
  callbackUrl: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface StkQueryResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  resultCode: string;
  resultDesc: string;
}

export interface MpesaCallbackItem {
  Name: string;
  Value?: string | number;
}

export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: MpesaCallbackItem[];
      };
    };
  };
}

function getEnv(): MpesaEnv {
  const env = process.env.MPESA_ENV ?? "sandbox";
  return env === "production" ? "production" : "sandbox";
}

function getConfig() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!consumerKey) throw new Error("MPESA_CONSUMER_KEY is not configured");
  if (!consumerSecret) throw new Error("MPESA_CONSUMER_SECRET is not configured");
  if (!shortcode) throw new Error("MPESA_SHORTCODE is not configured");
  if (!passkey) throw new Error("MPESA_PASSKEY is not configured");

  return { consumerKey, consumerSecret, shortcode, passkey };
}

/**
 * Resolve the M-Pesa TransactionType.
 * Set MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline for Till numbers.
 * Defaults to CustomerPayBillOnline (Paybill).
 */
function getTransactionType(): string {
  const t = process.env.MPESA_TRANSACTION_TYPE ?? "CustomerPayBillOnline";
  if (t !== "CustomerPayBillOnline" && t !== "CustomerBuyGoodsOnline") {
    logger.warn({ type: t }, "[M-Pesa] Unknown MPESA_TRANSACTION_TYPE — defaulting to CustomerPayBillOnline");
    return "CustomerPayBillOnline";
  }
  return t;
}

/**
 * Log the current M-Pesa configuration state (no secret values).
 * Called at startup to make production issues obvious.
 */
export function logMpesaConfigStatus(): void {
  const env = getEnv();
  const shortcode = process.env.MPESA_SHORTCODE ?? "";
  const knownSandboxShortcodes = ["174379", "174376", "600000", "600001", "600002"];
  const isSandboxShortcode = knownSandboxShortcodes.includes(shortcode);

  const configured = {
    MPESA_ENV: env,
    MPESA_CONSUMER_KEY: !!process.env.MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET: !!process.env.MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE: shortcode || "(not set)",
    MPESA_SHORTCODE_looks_like_sandbox: isSandboxShortcode,
    MPESA_PASSKEY: !!process.env.MPESA_PASSKEY,
    MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL ?? "(will auto-detect from Replit domain)",
    MPESA_TRANSACTION_TYPE: process.env.MPESA_TRANSACTION_TYPE ?? "CustomerPayBillOnline (default)",
  };

  if (env === "production" && isSandboxShortcode) {
    logger.error(
      { shortcode, configured },
      "[M-Pesa] ⚠️  PRODUCTION mode but SANDBOX shortcode detected — STK push will fail. " +
      "Use your real production shortcode or set MPESA_ENV=sandbox for testing.",
    );
  }

  const missing = (["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY"] as const)
    .filter((k) => !process.env[k]);

  if (env === "production" && missing.length > 0) {
    logger.error(
      { missing, configured },
      "[M-Pesa] ⚠️  PRODUCTION mode but credentials are MISSING — payments will fail",
    );
  } else {
    logger.info(configured, `[M-Pesa] Configuration loaded (${env})`);
  }
}

function baseUrl(): string {
  return DARAJA_URLS[getEnv()].base;
}

async function handleDarajaResponse<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    throw new Error(`Daraja [${label}] ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export class MpesaService {
  private tokenCache: { value: string; expiresAt: number } | null = null;

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.value;
    }

    const { consumerKey, consumerSecret } = getConfig();
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const env = getEnv();

    try {
      const res = await fetch(
        `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        },
      );

      const data = await handleDarajaResponse<{ access_token: string; expires_in: string }>(
        res,
        "getAccessToken",
      );

      const expiresIn = parseInt(data.expires_in, 10) || 3600;
      this.tokenCache = {
        value: data.access_token,
        expiresAt: Date.now() + (expiresIn - 60) * 1000,
      };

      logger.info({ env, expiresIn }, "[M-Pesa] OAuth token acquired");
      return data.access_token;
    } catch (err) {
      this.tokenCache = null;
      logger.error({ err, env }, "[M-Pesa] OAuth token acquisition FAILED — cache cleared");
      throw err;
    }
  }

  /**
   * Initiate an M-Pesa STK push (Lipa Na M-Pesa Online).
   * Returns the MerchantRequestID and CheckoutRequestID for tracking.
   */
  async initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
    const { consumerKey: _k, consumerSecret: _s, shortcode, passkey } = getConfig();
    const token = await this.getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const normalizedPhone = this.normalizePhone(params.phone);

    logger.info(
      { phone: normalizedPhone, amount: params.amount, ref: params.accountRef },
      "Initiating M-Pesa STK push",
    );

    const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: getTransactionType(),
        Amount: Math.ceil(params.amount),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: params.callbackUrl,
        AccountReference: params.accountRef.slice(0, 12),
        TransactionDesc: params.description.slice(0, 13),
      }),
    });

    const data = await handleDarajaResponse<{
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResponseCode: string;
      ResponseDescription: string;
      CustomerMessage: string;
    }>(res, "initiateStkPush");

    if (data.ResponseCode !== "0") {
      throw new Error(`STK push rejected: ${data.ResponseDescription}`);
    }

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
    };
  }

  /**
   * Query the status of a pending STK push transaction.
   */
  async queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
    const { consumerKey: _k, consumerSecret: _s, shortcode, passkey } = getConfig();
    const token = await this.getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });

    const data = await handleDarajaResponse<{
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResponseCode: string;
      ResponseDescription: string;
      ResultCode: string;
      ResultDesc: string;
    }>(res, "queryStkStatus");

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc,
    };
  }

  /**
   * Extract a named item from CallbackMetadata.Item array.
   */
  extractMetadataItem(
    items: MpesaCallbackItem[],
    name: string,
  ): string | number | undefined {
    return items.find((i) => i.Name === name)?.Value;
  }

  /**
   * Normalize a Kenyan phone number to the 254XXXXXXXXX format Safaricom expects.
   */
  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }
    if (digits.startsWith("254") && digits.length === 12) {
      return digits;
    }
    if (digits.startsWith("7") && digits.length === 9) {
      return `254${digits}`;
    }
    return digits;
  }

  /**
   * Validate that a callback payload has the required structure.
   */
  isValidCallback(body: unknown): body is MpesaCallbackPayload {
    if (typeof body !== "object" || body === null) return false;
    const b = body as Record<string, unknown>;
    if (typeof b["Body"] !== "object" || b["Body"] === null) return false;
    const body2 = b["Body"] as Record<string, unknown>;
    if (typeof body2["stkCallback"] !== "object" || body2["stkCallback"] === null) return false;
    const cb = body2["stkCallback"] as Record<string, unknown>;
    return (
      typeof cb["MerchantRequestID"] === "string" &&
      typeof cb["CheckoutRequestID"] === "string" &&
      typeof cb["ResultCode"] === "number"
    );
  }
}

export const mpesaService = new MpesaService();
