import { eq, and, gte, or } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  plansTable,
  usersTable,
  auditLogsTable,
  adminSettingsTable,
} from "@workspace/db";
import { mpesaService, type MpesaCallbackPayload } from "./mpesa.service.js";
import { relationshipService } from "./relationship.service.js";
import { logger } from "../lib/logger.js";
import { addTradingDays } from "../lib/trading-days.js";
import { getMpesaCallbackUrl } from "../lib/mpesa-callback-url.js";
import { PaymentQueue, NotificationQueue } from "../queues/queues.js";

export interface InitiatePaymentParams {
  userId: string;
  planId: string | null;
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
   * When planId is null, uses admin settings fee per day.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { userId, planId, numberOfDays, phone } = params;

    logger.info({ userId, planId, numberOfDays }, "[Payment] Initiating payment");

    // ── Step 1: Resolve fee and validate days ─────────────────────────────────
    let feePerDay: number;
    let planName: string;
    let resolvedPlanId: string | null = null;

    if (planId) {
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

      feePerDay = Number(plan.pricePerDay);
      planName = plan.name;
      resolvedPlanId = plan.id;
      logger.info({ planId, planName, feePerDay }, "[Payment] Plan validated");
    } else {
      const [settings] = await db
        .select({
          subscriptionFeePerDay: adminSettingsTable.subscriptionFeePerDay,
          minimumSubscriptionDays: adminSettingsTable.minimumSubscriptionDays,
          maximumSubscriptionDays: adminSettingsTable.maximumSubscriptionDays,
        })
        .from(adminSettingsTable)
        .where(eq(adminSettingsTable.key, "default"))
        .limit(1);

      feePerDay = Number(settings?.subscriptionFeePerDay ?? 100);
      const minDays = settings?.minimumSubscriptionDays ?? 7;
      const maxDays = settings?.maximumSubscriptionDays ?? 365;
      planName = "Standard";

      if (numberOfDays < minDays) {
        throw new Error(`Minimum subscription is ${minDays} days`);
      }
      if (numberOfDays > maxDays) {
        throw new Error(`Maximum subscription is ${maxDays} days`);
      }

      logger.info({ feePerDay, minDays, maxDays }, "[Payment] Using admin settings fee (no plan)");
    }

    // ── Step 2: Validate user ─────────────────────────────────────────────────
    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const amount = feePerDay * numberOfDays;
    const billingPhone = phone || user.phone || "";

    if (!billingPhone) throw new Error("Phone number is required for M-Pesa payment");

    logger.info({ userId, phone: billingPhone, amount }, "[Payment] User and amount resolved");

    // ── Step 3: Idempotency guard ─────────────────────────────────────────────
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
        planId: resolvedPlanId,
        status: "pending",
        isActive: false,
        numberOfDays,
        amountPaid: String(amount),
      })
      .returning();

    logger.info(
      { subscriptionId: subscription.id, userId, planId: resolvedPlanId, numberOfDays, amount },
      "[Payment] Pending subscription created",
    );

    // ── Step 5: Create payment record (pending) ───────────────────────────────
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
      const callbackUrl = getMpesaCallbackUrl();
      logger.info(
        { paymentId: payment.id, phone: billingPhone, amount, callbackUrl },
        "[Payment] Firing STK push to Safaricom Daraja",
      );

      const stkResult = await mpesaService.initiateStkPush({
        phone: billingPhone,
        amount,
        accountRef: `PM-${subscription.id.slice(0, 8).toUpperCase()}`,
        description: `PesaMatrix ${planName} ${numberOfDays}d`,
        callbackUrl,
      });

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

      await PaymentQueue.add(
        "poll-payment-status",
        {
          type: "poll-payment-status",
          paymentId: payment.id,
          checkoutRequestId: stkResult.checkoutRequestId,
          userId,
        },
        {
          delay: 45_000,
          attempts: 4,
          backoff: { type: "fixed", delay: 30_000 },
          jobId: `poll:${stkResult.checkoutRequestId}`,
        },
      ).catch((err) => {
        logger.warn(
          { err, paymentId: payment.id, checkoutRequestId: stkResult.checkoutRequestId },
          "[Payment] Failed to enqueue poll job — callback is still primary path",
        );
      });

      return {
        paymentId: payment.id,
        subscriptionId: subscription.id,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        customerMessage: stkResult.customerMessage,
        amount,
      };
    } catch (err) {
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

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.checkoutRequestId, CheckoutRequestID))
      .limit(1);

    if (!payment) {
      logger.warn({ checkoutRequestId: CheckoutRequestID }, "[Callback] No payment found — ignoring");
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
        "[Callback] Duplicate callback detected — already processed",
      );
      return {
        success: payment.status === "completed",
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? null,
        mpesaRef: payment.mpesaRef,
        message: "Already processed",
      };
    }

    if (ResultCode !== 0) {
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
      }

      await db.insert(auditLogsTable).values({
        action: "payment_failed",
        userId: payment.userId,
        targetId: payment.id,
        targetType: "payment",
        metadata: { checkoutRequestId: CheckoutRequestID, resultCode: ResultCode, resultDesc: ResultDesc },
      }).catch(() => {});

      await NotificationQueue.add("payment-failed", {
        type: "payment-failed",
        userId: payment.userId,
        paymentId: payment.id,
        reason: ResultDesc,
      }).catch(() => {});

      return {
        success: false,
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId ?? null,
        mpesaRef: null,
        message: ResultDesc,
      };
    }

    const items = CallbackMetadata?.Item ?? [];
    const mpesaRef = String(mpesaService.extractMetadataItem(items, "MpesaReceiptNumber") ?? "");
    const paidAmount = Number(mpesaService.extractMetadataItem(items, "Amount") ?? payment.amount);

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
      logger.warn({ paymentId: payment.id }, "[Callback] Payment has no linked subscription");
      await db.insert(auditLogsTable).values({
        action: "payment_completed",
        userId: payment.userId,
        targetId: payment.id,
        targetType: "payment",
        metadata: { mpesaRef, paidAmount, checkoutRequestId: CheckoutRequestID },
      }).catch(() => {});
      return { success: true, paymentId: payment.id, subscriptionId: null, mpesaRef, message: "Payment completed" };
    }

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
      logger.error({ subscriptionId }, "[Callback] Linked subscription not found — cannot activate");
      return { success: true, paymentId: payment.id, subscriptionId, mpesaRef, message: "Payment completed but subscription not found" };
    }

    const { startDate, endDate, isRenewal } = computeDates(
      subscription.status,
      subscription.endDate,
      subscription.numberOfDays,
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
      { subscriptionId, startDate, endDate, isRenewal },
      "[Callback] Subscription ACTIVATED",
    );

    const cfResult = await relationshipService
      .onSubscriptionActivated({ subscriptionId, userId: subscription.userId })
      .catch((err) => {
        logger.error({ err, subscriptionId }, "[Callback] CopyFactory attach failed — will retry");
        return null;
      });

    if (cfResult) {
      logger.info({ subscriptionId, relationshipId: cfResult.relationshipId }, "[Callback] CopyFactory relationship registered — copy trading ENABLED");
    }

    await db.insert(auditLogsTable).values({
      action: "payment_completed",
      userId: payment.userId,
      targetId: payment.id,
      targetType: "payment",
      metadata: { mpesaRef, paidAmount, checkoutRequestId: CheckoutRequestID, subscriptionId },
    }).catch(() => {});

    await db.insert(auditLogsTable).values({
      action: "subscription_activated",
      userId: subscription.userId,
      targetId: subscriptionId,
      targetType: "subscription",
      metadata: { mpesaRef, paymentId: payment.id, startDate, endDate, isRenewal, copyFactoryAttached: cfResult !== null },
    }).catch(() => {});

    await NotificationQueue.add("payment-confirmed", {
      type: "payment-confirmed",
      userId: payment.userId,
      mpesaRef,
      amount: paidAmount,
      subscriptionId,
    }).catch(() => {});

    await NotificationQueue.add("subscription-activated", {
      type: "subscription-activated",
      userId: subscription.userId,
      subscriptionId,
      endDate: endDate.toISOString(),
    }).catch(() => {});

    logger.info({ paymentId: payment.id, subscriptionId, mpesaRef }, "[Callback] Callback processing COMPLETE");

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId,
      mpesaRef,
      message: "Payment completed and subscription activated",
    };
  }

  async checkPaymentStatus(checkoutRequestId: string, userId: string) {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.checkoutRequestId, checkoutRequestId),
          eq(paymentsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!payment) {
      throw new Error("Payment not found");
    }

    return {
      paymentId: payment.id,
      subscriptionId: payment.subscriptionId,
      status: payment.status,
      mpesaRef: payment.mpesaRef,
      amount: Number(payment.amount),
      resultCode: payment.resultCode,
      resultDesc: payment.resultDesc,
    };
  }

  async getPaymentById(paymentId: string, userId: string) {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.id, paymentId),
          eq(paymentsTable.userId, userId),
        ),
      )
      .limit(1);

    return payment ?? null;
  }
}

export const paymentService = new PaymentService();
