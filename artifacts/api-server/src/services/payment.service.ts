import { eq, and } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  plansTable,
  usersTable,
} from "@workspace/db";
import { mpesaService, type MpesaCallbackPayload } from "./mpesa.service.js";
import { relationshipService } from "./relationship.service.js";
import { logger } from "../lib/logger.js";

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
}

export interface CallbackResult {
  success: boolean;
  paymentId: string;
  subscriptionId: string | null;
  mpesaRef: string | null;
  message: string;
}

function getCallbackUrl(): string {
  const url = process.env.MPESA_CALLBACK_URL;
  if (!url) throw new Error("MPESA_CALLBACK_URL is not configured");
  return url;
}

export class PaymentService {
  /**
   * Create a pending subscription + payment record, then fire an STK push.
   * The subscription becomes active only after the M-Pesa callback confirms success.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { userId, planId, numberOfDays, phone } = params;

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

    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const amount = Number(plan.pricePerDay) * numberOfDays;
    const billingPhone = phone || user.phone || "";

    if (!billingPhone) throw new Error("Phone number is required for M-Pesa payment");

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

    try {
      const stkResult = await mpesaService.initiateStkPush({
        phone: billingPhone,
        amount,
        accountRef: `PM-${subscription.id.slice(0, 8).toUpperCase()}`,
        description: `PesaMatrix ${plan.name}`,
        callbackUrl: getCallbackUrl(),
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
          amount,
        },
        "STK push initiated",
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
      await db
        .update(paymentsTable)
        .set({ status: "failed", resultDesc: err instanceof Error ? err.message : "STK push failed", updatedAt: new Date() })
        .where(eq(paymentsTable.id, payment.id));

      await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscription.id));

      throw err;
    }
  }

  /**
   * Process an incoming M-Pesa STK callback.
   *
   * On success (ResultCode=0):
   *  - Marks payment completed with the M-Pesa receipt number
   *  - Activates the subscription with start/end dates
   *  - Calls RelationshipService.onSubscriptionActivated() to attach the
   *    subscriber to the CopyFactory master strategy
   *
   * On failure (ResultCode≠0):
   *  - Marks payment failed; subscription remains pending
   */
  async handleCallback(body: MpesaCallbackPayload): Promise<CallbackResult> {
    const { stkCallback } = body.Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      stkCallback;

    logger.info(
      { checkoutRequestId: CheckoutRequestID, resultCode: ResultCode },
      "Processing M-Pesa callback",
    );

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.checkoutRequestId, CheckoutRequestID))
      .limit(1);

    if (!payment) {
      logger.warn({ checkoutRequestId: CheckoutRequestID }, "Payment not found for callback");
      return {
        success: false,
        paymentId: "",
        subscriptionId: null,
        mpesaRef: null,
        message: "Payment record not found",
      };
    }

    if (payment.status === "completed" || payment.status === "failed") {
      logger.info({ paymentId: payment.id }, "Duplicate callback received — skipping");
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

      logger.info({ paymentId: payment.id, resultCode: ResultCode, resultDesc: ResultDesc }, "Payment failed");

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

    let subscriptionId = payment.subscriptionId ?? null;

    if (subscriptionId) {
      const [subscription] = await db
        .select({ id: subscriptionsTable.id, userId: subscriptionsTable.userId, numberOfDays: subscriptionsTable.numberOfDays, status: subscriptionsTable.status, endDate: subscriptionsTable.endDate })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (subscription) {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (subscription.status === "active" && subscription.endDate && subscription.endDate > now) {
          startDate = subscription.endDate;
          endDate = new Date(subscription.endDate.getTime() + subscription.numberOfDays * 24 * 60 * 60 * 1000);
          logger.info({ subscriptionId, endDate }, "Renewing subscription — extending end date");
        } else {
          startDate = now;
          endDate = new Date(now.getTime() + subscription.numberOfDays * 24 * 60 * 60 * 1000);
          logger.info({ subscriptionId, endDate }, "Activating new subscription");
        }

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

        const cfResult = await relationshipService.onSubscriptionActivated({
          subscriptionId,
          userId: subscription.userId,
        }).catch((err) => {
          logger.error({ err, subscriptionId }, "CopyFactory attach failed after payment — will retry via scheduler");
          return null;
        });

        logger.info(
          { paymentId: payment.id, subscriptionId, copyfactoryAttached: cfResult !== null },
          "Payment completed and subscription activated",
        );
      }
    }

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId,
      mpesaRef,
      message: "Payment processed successfully",
    };
  }

  /**
   * Poll Daraja to check if a pending payment has been confirmed.
   * Useful as a fallback when callbacks are delayed.
   */
  async checkPaymentStatus(checkoutRequestId: string): Promise<{
    status: string;
    resultCode: string | null;
    resultDesc: string | null;
  }> {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.checkoutRequestId, checkoutRequestId))
      .limit(1);

    if (!payment) throw new Error("Payment not found");

    if (payment.status === "completed" || payment.status === "failed") {
      return {
        status: payment.status,
        resultCode: payment.resultCode,
        resultDesc: payment.resultDesc,
      };
    }

    try {
      const queryResult = await mpesaService.queryStkStatus(checkoutRequestId);

      if (queryResult.resultCode === "0") {
        logger.info({ checkoutRequestId }, "Payment confirmed via STK query");
      }

      return {
        status: queryResult.resultCode === "0" ? "completed" : "processing",
        resultCode: queryResult.resultCode,
        resultDesc: queryResult.resultDesc,
      };
    } catch (err) {
      logger.warn({ err, checkoutRequestId }, "STK query failed — returning cached status");
      return { status: payment.status, resultCode: payment.resultCode, resultDesc: payment.resultDesc };
    }
  }
}

export const paymentService = new PaymentService();
