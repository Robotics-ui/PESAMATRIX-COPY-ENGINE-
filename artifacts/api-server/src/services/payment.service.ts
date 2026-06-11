import { eq, and, gte, or } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  plansTable,
  usersTable,
  auditLogsTable,
} from "@workspace/db";
import { mpesaService, type MpesaCallbackPayload } from "./mpesa.service.js";
import { relationshipService } from "./relationship.service.js";
import { logger } from "../lib/logger.js";
import { addTradingDays } from "../lib/trading-days.js";

export interface InitiatePaymentParams {
  userId: string;
  planId: string;
  numberOfDays: number;
  phone: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  subscriptionId: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
  amount: number;
  idempotent?: boolean;
}

export interface CallbackResult {
  success: boolean;
  paymentId: string;
  subscriptionId: string | null;
  mpesaRef: string | null;
  message: string;
}

function getCallbackUrl(): string {
  const explicit = process.env.MPESA_CALLBACK_URL;
  if (explicit) return explicit;

  // Auto-detect from Replit runtime domain env vars
  const replitDomains = process.env.REPLIT_DOMAINS;
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const domain = replitDomains
    ? replitDomains.split(",")[0]?.trim()
    : replitDevDomain;

  if (domain) {
    const url = `https://${domain}/api/payments/mpesa/callback`;
    logger.info({ callbackUrl: url }, "[M-Pesa] Auto-detected callback URL from Replit domain");
    return url;
  }

  throw new Error(
    "MPESA_CALLBACK_URL is not configured and no Replit domain is available. " +
    "Set MPESA_CALLBACK_URL to your public HTTPS callback endpoint.",
  );
}

/**
 * Compute subscription start/end dates using TRADING DAYS (Mon–Fri only).
 * Weekends do not count against the subscription balance.
 * If the subscription is already active and not yet expired, extend from the
 * current endDate (renewal). Otherwise start from now.
 */
function computeDates(
  currentStatus: string,
  currentEndDate: Date | null,
  numberOfDays: number,
): { startDate: Date; endDate: Date; isRenewal: boolean } {
  const now = new Date();
  const isRenewal =
    currentStatus === "active" && currentEndDate !== null && currentEndDate > now;

  const startDate = isRenewal ? currentEndDate! : now;
  const endDate = addTradingDays(startDate, numberOfDays);

  return { startDate, endDate, isRenewal };
}

export class PaymentService {
  /**
   * Create a pending subscription + payment record, then fire an STK push.
   *
   * Idempotency: if the user already has a `processing` payment created in the
   * last 10 minutes, return it immediately without firing a new STK push.
   * This prevents double-charges when the user taps "Pay" multiple times.
   *
   * The subscription becomes active only after the M-Pesa callback confirms
   * success.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { userId, planId, numberOfDays, phone } = params;

    logger.info({ userId, planId, numberOfDays }, "[Payment] Initiating payment");

    // ── Step 1: Validate plan ─────────────────────────────────────────────────
    const [plan] = await db
      .select()
      .from(plansTable)
      .where(and(eq(plansTable.id, planId), eq(plansTable.isActive, true)))
      .limit(1);

    if (!plan) throw new Error("Plan not found or inactive");

    if (numberOfDays < plan.minimumDays) {
      throw new Error(`Minimum subscription is ${plan.minimumDays} days`);
    }
    if (numberOfDays > plan.maximumDays) {
      throw new Error(`Maximum subscription is ${plan.maximumDays} days`);
    }

    logger.info({ planId, planName: plan.name, pricePerDay: plan.pricePerDay }, "[Payment] Plan validated");

    // ── Step 2: Validate user ─────────────────────────────────────────────────
    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const amount = Number(plan.pricePerDay) * numberOfDays;
    const billingPhone = phone || user.phone || "";

    if (!billingPhone) throw new Error("Phone number is required for M-Pesa payment");

    logger.info({ userId, phone: billingPhone, amount }, "[Payment] User and amount resolved");

    // ── Step 3: Idempotency guard — block duplicate STK pushes ────────────────
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [existingProcessing] = await db
      .select({
        id: paymentsTable.id,
        subscriptionId: paymentsTable.subscriptionId,
        checkoutRequestId: paymentsTable.checkoutRequestId,
        merchantRequestId: paymentsTable.merchantRequestId,
        amount: paymentsTable.amount,
        status: paymentsTable.status,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.userId, userId),
          or(
            eq(paymentsTable.status, "pending"),
            eq(paymentsTable.status, "processing"),
          ),
          gte(paymentsTable.createdAt, tenMinutesAgo),
        ),
      )
      .orderBy(paymentsTable.createdAt)
      .limit(1);

    if (existingProcessing && existingProcessing.checkoutRequestId) {
      logger.info(
        {
          userId,
          existingPaymentId: existingProcessing.id,
          checkoutRequestId: existingProcessing.checkoutRequestId,
          status: existingProcessing.status,
        },
        "[Payment] Idempotency hit — returning existing processing payment",
      );

      return {
        paymentId: existingProcessing.id,
        subscriptionId: existingProcessing.subscriptionId ?? "",
        checkoutRequestId: existingProcessing.checkoutRequestId,
        merchantRequestId: existingProcessing.merchantRequestId ?? "",
        customerMessage: "Payment already initiated. Please check your phone for the M-Pesa prompt.",
        amount: Number(existingProcessing.amount),
        idempotent: true,
      };
    }

    // ── Step 4: Create subscription (pending) ─────────────────────────────────
    const [subscription] = await db
      .insert(subscriptionsTable)
      .values({
        userId,
        planId,
        status: "pending",
        isActive: false,
        numberOfDays,
        amountPaid: String(amount),
      })
      .returning();

    logger.info(
      { subscriptionId: subscription.id, userId, planId, numberOfDays, amount },
      "[Payment] Pending subscription created",
    );

    // ── Step 5: Create payment record (pending) ────────────────────────────────
    const [payment] = await db
      .insert(paymentsTable)
      .values({
        userId,
        subscriptionId: subscription.id,
        amount: String(amount),
        phone: mpesaService.normalizePhone(billingPhone),
        status: "pending",
      })
      .returning();

    logger.info(
      { paymentId: payment.id, subscriptionId: subscription.id, amount },
      "[Payment] Pending payment record created",
    );

    // ── Step 6: Fire STK push ─────────────────────────────────────────────────
    try {
      logger.info(
        { paymentId: payment.id, phone: billingPhone, amount },
        "[Payment] Firing STK push to Safaricom Daraja",
      );

      const stkResult = await mpesaService.initiateStkPush({
        phone: billingPhone,
        amount,
        accountRef: `PM-${subscription.id.slice(0, 8).toUpperCase()}`,
        description: `PesaMatrix ${plan.name}`,
        callbackUrl: getCallbackUrl(),
      });

      // ── Step 7: Mark payment as processing ───────────────────────────────────
      await db
        .update(paymentsTable)
        .set({
          status: "processing",
          checkoutRequestId: stkResult.checkoutRequestId,
          merchantRequestId: stkResult.merchantRequestId,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id));

      logger.info(
        {
          paymentId: payment.id,
          subscriptionId: subscription.id,
          checkoutRequestId: stkResult.checkoutRequestId,
          merchantRequestId: stkResult.merchantRequestId,
          amount,
        },
        "[Payment] STK push successful — waiting for M-Pesa callback",
      );

      return {
        paymentId: payment.id,
        subscriptionId: subscription.id,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        customerMessage: stkResult.customerMessage,
        amount,
      };
    } catch (err) {
      // ── Step 8: Rollback on STK failure ──────────────────────────────────────
      const errMsg = err instanceof Error ? err.message : "STK push failed";

      logger.error(
        { err, paymentId: payment.id, subscriptionId: subscription.id },
        "[Payment] STK push failed — marking payment and subscription as failed/cancelled",
      );

      await db
        .update(paymentsTable)
        .set({ status: "failed", resultDesc: errMsg, updatedAt: new Date() })
        .where(eq(paymentsTable.id, payment.id));

      await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscription.id));

      throw err;
    }
  }

  /**
   * Process an incoming M-Pesa STK callback from Safaricom.
   *
   * Duplicate-callback protection: we use a conditional atomic UPDATE
   * (`WHERE status = 'processing'`) so only the first callback wins.
   * Concurrent duplicates see 0 rows affected and short-circuit.
   *
   * On success (ResultCode=0):
   *  1. Mark payment completed with the M-Pesa receipt number
   *  2. Activate the subscription with computed start/end dates
   *  3. Register CopyFactory relationship and enable copy trading
   *
   * On failure (ResultCode≠0):
   *  - Mark payment failed and cancel the pending subscription
   */
  async handleCallback(body: MpesaCallbackPayload): Promise<CallbackResult> {
    const { stkCallback } = body.Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      stkCallback;

    logger.info(
      {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      },
      "[Callback] Received M-Pesa STK callback",
    );

    // ── Step 1: Look up the payment record ────────────────────────────────────
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.checkoutRequestId, CheckoutRequestID))
      .limit(1);

    if (!payment) {
      logger.warn({ checkoutRequestId: CheckoutRequestID }, "[Callback] No payment found for checkoutRequestId — ignoring");
      return {
        success: false,
        paymentId: "",
        subscriptionId: null,
        mpesaRef: null,
        message: "Payment record not found",
      };
    }

    logger.info(
      { paymentId: payment.id, currentStatus: payment.status, userId: payment.userId },
      "[Callback] Payment record found",
    );

    // ── Step 2: Atomic duplicate-callback guard ───────────────────────────────
    // Only update if status is still 'processing'. If two callbacks arrive
    // simultaneously, only one UPDATE will find a matching row and win.
    const claimedRows = await db
      .update(paymentsTable)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(paymentsTable.id, payment.id),
          eq(paymentsTable.status, "processing"),
        ),
      )
      .returning({ id: paymentsTable.id });

    if (claimedRows.length === 0) {
      logger.info(
        { paymentId: payment.id, currentStatus: payment.status },
        "[Callback] Duplicate callback detected — payment already processed, skipping",
      );
      return {
        success: payment.status === "completed",
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? null,
        mpesaRef: payment.mpesaRef,
        message: "Already processed",
      };
    }

    logger.info({ paymentId: payment.id }, "[Callback] Callback lock acquired — processing");

    // ── Step 3: Handle failed payment ─────────────────────────────────────────
    if (ResultCode !== 0) {
      logger.info(
        { paymentId: payment.id, resultCode: ResultCode, resultDesc: ResultDesc },
        "[Callback] M-Pesa transaction failed — marking payment failed",
      );

      await db
        .update(paymentsTable)
        .set({
          status: "failed",
          resultCode: String(ResultCode),
          resultDesc: ResultDesc,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id));

      if (payment.subscriptionId) {
        await db
          .update(subscriptionsTable)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, payment.subscriptionId));

        logger.info(
          { subscriptionId: payment.subscriptionId },
          "[Callback] Pending subscription cancelled after failed payment",
        );
      }

      await db
        .insert(auditLogsTable)
        .values({
          action: "payment_failed",
          userId: payment.userId,
          targetId: payment.id,
          targetType: "payment",
          metadata: {
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            subscriptionId: payment.subscriptionId,
          },
        })
        .catch(() => {});

      return {
        success: false,
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? null,
        mpesaRef: null,
        message: ResultDesc,
      };
    }

    // ── Step 4: Extract M-Pesa receipt metadata ───────────────────────────────
    const items = CallbackMetadata?.Item ?? [];
    const mpesaRef = String(mpesaService.extractMetadataItem(items, "MpesaReceiptNumber") ?? "");
    const paidAmount = Number(mpesaService.extractMetadataItem(items, "Amount") ?? payment.amount);
    const transactionDate = mpesaService.extractMetadataItem(items, "TransactionDate");
    const phoneUsed = mpesaService.extractMetadataItem(items, "PhoneNumber");

    logger.info(
      { paymentId: payment.id, mpesaRef, paidAmount, transactionDate, phoneUsed },
      "[Callback] M-Pesa transaction successful — receipt received",
    );

    // ── Step 5: Mark payment completed ────────────────────────────────────────
    await db
      .update(paymentsTable)
      .set({
        status: "completed",
        mpesaRef,
        resultCode: "0",
        resultDesc: ResultDesc,
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, payment.id));

    logger.info({ paymentId: payment.id, mpesaRef }, "[Callback] Payment marked COMPLETED");

    let subscriptionId = payment.subscriptionId ?? null;

    if (!subscriptionId) {
      logger.warn({ paymentId: payment.id }, "[Callback] Payment has no linked subscription — skipping activation");

      await db
        .insert(auditLogsTable)
        .values({
          action: "payment_completed",
          userId: payment.userId,
          targetId: payment.id,
          targetType: "payment",
          metadata: { mpesaRef, paidAmount, checkoutRequestId: CheckoutRequestID },
        })
        .catch(() => {});

      return { success: true, paymentId: payment.id, subscriptionId: null, mpesaRef, message: "Payment completed" };
    }

    // ── Step 6: Activate subscription ─────────────────────────────────────────
    const [subscription] = await db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        planId: subscriptionsTable.planId,
        numberOfDays: subscriptionsTable.numberOfDays,
        status: subscriptionsTable.status,
        endDate: subscriptionsTable.endDate,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      logger.error({ subscriptionId }, "[Callback] Linked subscription not found in DB — cannot activate");
      return { success: true, paymentId: payment.id, subscriptionId, mpesaRef, message: "Payment completed but subscription not found" };
    }

    const { startDate, endDate, isRenewal } = computeDates(
      subscription.status,
      subscription.endDate,
      subscription.numberOfDays,
    );

    logger.info(
      { subscriptionId, startDate, endDate, isRenewal, numberOfDays: subscription.numberOfDays },
      isRenewal
        ? "[Callback] Renewing subscription — extending end date"
        : "[Callback] Activating new subscription",
    );

    await db
      .update(subscriptionsTable)
      .set({
        status: "active",
        isActive: true,
        startDate,
        endDate,
        amountPaid: String(paidAmount),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subscriptionId));

    logger.info(
      { subscriptionId, startDate, endDate },
      "[Callback] Subscription ACTIVATED with expiry date set",
    );

    // ── Step 7: Register CopyFactory relationship ──────────────────────────────
    logger.info(
      { subscriptionId, userId: subscription.userId },
      "[Callback] Registering CopyFactory relationship and enabling copy trading",
    );

    const cfResult = await relationshipService
      .onSubscriptionActivated({
        subscriptionId,
        userId: subscription.userId,
      })
      .catch((err) => {
        logger.error(
          { err, subscriptionId, userId: subscription.userId },
          "[Callback] CopyFactory attach failed — will retry via scheduler",
        );
        return null;
      });

    if (cfResult) {
      logger.info(
        {
          subscriptionId,
          userId: subscription.userId,
          relationshipId: cfResult.relationshipId,
          metaApiAccountId: cfResult.metaApiAccountId,
          strategyId: cfResult.strategyId,
        },
        "[Callback] CopyFactory relationship registered — copy trading ENABLED",
      );
    } else {
      logger.info(
        { subscriptionId, userId: subscription.userId },
        "[Callback] CopyFactory attach skipped (no deployed account yet) — will attach at deploy time",
      );
    }

    // ── Step 8: Write audit logs ───────────────────────────────────────────────
    await db
      .insert(auditLogsTable)
      .values({
        action: "payment_completed",
        userId: payment.userId,
        targetId: payment.id,
        targetType: "payment",
        metadata: {
          mpesaRef,
          paidAmount,
          checkoutRequestId: CheckoutRequestID,
          subscriptionId,
        },
      })
      .catch(() => {});

    await db
      .insert(auditLogsTable)
      .values({
        action: "subscription_activated",
        userId: subscription.userId,
        targetId: subscriptionId,
        targetType: "subscription",
        metadata: {
          mpesaRef,
          paymentId: payment.id,
          startDate,
          endDate,
          isRenewal,
          copyFactoryAttached: cfResult !== null,
        },
      })
      .catch(() => {});

    logger.info(
      {
        paymentId: payment.id,
        subscriptionId,
        mpesaRef,
        startDate,
        endDate,
        copyFactoryAttached: cfResult !== null,
      },
      "[Callback] Full payment workflow COMPLETE",
    );

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId,
      mpesaRef,
      message: "Payment processed successfully",
    };
  }

  /**
   * Poll Daraja to check if a pending/processing payment has been confirmed.
   * Used as a fallback when callbacks are delayed.
   *
   * If Daraja confirms the payment succeeded (ResultCode=0), the full
   * activation workflow is triggered (subscription + CopyFactory).
   */
  async checkPaymentStatus(
    checkoutRequestId: string,
    userId?: string,
  ): Promise<{
    status: string;
    resultCode: string | null;
    resultDesc: string | null;
    mpesaRef: string | null;
    subscriptionId: string | null;
    paymentId: string | null;
  }> {
    logger.info({ checkoutRequestId }, "[PaymentStatus] Checking payment status");

    const whereClause = userId
      ? and(
          eq(paymentsTable.checkoutRequestId, checkoutRequestId),
          eq(paymentsTable.userId, userId),
        )
      : eq(paymentsTable.checkoutRequestId, checkoutRequestId);

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(whereClause)
      .limit(1);

    if (!payment) throw new Error("Payment not found");

    // Already in terminal state — return cached result
    if (payment.status === "completed" || payment.status === "failed") {
      logger.info(
        { paymentId: payment.id, status: payment.status },
        "[PaymentStatus] Returning cached terminal status",
      );
      return {
        status: payment.status,
        resultCode: payment.resultCode,
        resultDesc: payment.resultDesc,
        mpesaRef: payment.mpesaRef,
        subscriptionId: payment.subscriptionId ?? null,
        paymentId: payment.id,
      };
    }

    // Query Daraja for live status
    logger.info({ checkoutRequestId }, "[PaymentStatus] Querying Daraja STK status");

    try {
      const queryResult = await mpesaService.queryStkStatus(checkoutRequestId);

      logger.info(
        { checkoutRequestId, resultCode: queryResult.resultCode, resultDesc: queryResult.resultDesc },
        "[PaymentStatus] Daraja STK query result received",
      );

      // If Daraja confirms success, trigger the full activation workflow
      if (queryResult.resultCode === "0") {
        logger.info(
          { checkoutRequestId, paymentId: payment.id },
          "[PaymentStatus] Daraja confirms success — triggering full activation workflow",
        );

        const syntheticCallback: MpesaCallbackPayload = {
          Body: {
            stkCallback: {
              MerchantRequestID: payment.merchantRequestId ?? "",
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 0,
              ResultDesc: queryResult.resultDesc,
              CallbackMetadata: { Item: [] },
            },
          },
        };

        const callbackResult = await this.handleCallback(syntheticCallback).catch((err) => {
          logger.error({ err, paymentId: payment.id }, "[PaymentStatus] Activation via query failed");
          return null;
        });

        return {
          status: "completed",
          resultCode: "0",
          resultDesc: queryResult.resultDesc,
          mpesaRef: callbackResult?.mpesaRef ?? payment.mpesaRef,
          subscriptionId: callbackResult?.subscriptionId ?? payment.subscriptionId ?? null,
          paymentId: payment.id,
        };
      }

      // Non-zero result code — payment failed or still processing
      const derivedStatus =
        queryResult.resultCode === "" ? "processing" : "failed";

      return {
        status: derivedStatus,
        resultCode: queryResult.resultCode || null,
        resultDesc: queryResult.resultDesc,
        mpesaRef: null,
        subscriptionId: payment.subscriptionId ?? null,
        paymentId: payment.id,
      };
    } catch (err) {
      logger.warn({ err, checkoutRequestId }, "[PaymentStatus] STK query failed — returning cached DB status");
      return {
        status: payment.status,
        resultCode: payment.resultCode,
        resultDesc: payment.resultDesc,
        mpesaRef: payment.mpesaRef,
        subscriptionId: payment.subscriptionId ?? null,
        paymentId: payment.id,
      };
    }
  }

  /**
   * Fetch a single payment record by its ID, optionally scoped to a user.
   */
  async getPaymentById(
    paymentId: string,
    userId?: string,
  ) {
    const whereClause = userId
      ? and(eq(paymentsTable.id, paymentId), eq(paymentsTable.userId, userId))
      : eq(paymentsTable.id, paymentId);

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(whereClause)
      .limit(1);

    return payment ?? null;
  }
}

export const paymentService = new PaymentService();
