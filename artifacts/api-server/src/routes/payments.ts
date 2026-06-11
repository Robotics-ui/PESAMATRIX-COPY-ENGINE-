import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  plansTable,
  auditLogsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validate.js";
import { paymentService } from "../services/payment.service.js";
import { mpesaService } from "../services/mpesa.service.js";
import { logAudit } from "../lib/audit.js";
import type { AuthRequest } from "../middlewares/authenticate.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const InitiatePaymentSchema = z.object({
  planId: z.string().uuid(),
  numberOfDays: z.number().int().min(1),
  phone: z.string().min(9).max(15).optional(),
});

const CheckStatusSchema = z.object({
  checkoutRequestId: z.string().min(1),
});

router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.pricePerDay);

  res.json({ plans });
});

router.get("/subscriptions", authenticate, async (req: AuthRequest, res) => {
  const subscriptions = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(eq(subscriptionsTable.userId, req.user!.userId))
    .orderBy(desc(subscriptionsTable.createdAt));

  res.json({ subscriptions });
});

router.get("/subscriptions/active", authenticate, async (req: AuthRequest, res) => {
  const [subscription] = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(
      and(
        eq(subscriptionsTable.userId, req.user!.userId),
        eq(subscriptionsTable.status, "active"),
        eq(subscriptionsTable.isActive, true),
      ),
    )
    .orderBy(desc(subscriptionsTable.endDate))
    .limit(1);

  if (!subscription) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  res.json(subscription);
});

router.post(
  "/pay",
  authenticate,
  validateBody(InitiatePaymentSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof InitiatePaymentSchema>;

    try {
      const result = await paymentService.initiatePayment({
        userId: req.user!.userId,
        planId: body.planId,
        numberOfDays: body.numberOfDays,
        phone: body.phone ?? "",
      });

      await logAudit("payment_initiated", req, {
        userId: req.user!.userId,
        targetId: result.paymentId,
        targetType: "payment",
        metadata: {
          subscriptionId: result.subscriptionId,
          amount: result.amount,
          checkoutRequestId: result.checkoutRequestId,
        },
      });

      res.status(201).json({
        message: result.customerMessage,
        paymentId: result.paymentId,
        subscriptionId: result.subscriptionId,
        checkoutRequestId: result.checkoutRequestId,
        amount: result.amount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment initiation failed";
      res.status(400).json({ error: message });
    }
  },
);

router.get("/payments", authenticate, async (req: AuthRequest, res) => {
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, req.user!.userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);

  res.json({ payments });
});

router.post(
  "/payments/status",
  authenticate,
  validateBody(CheckStatusSchema),
  async (req: AuthRequest, res) => {
    const { checkoutRequestId } = req.body as z.infer<typeof CheckStatusSchema>;

    const [payment] = await db
      .select({ userId: paymentsTable.userId })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.checkoutRequestId, checkoutRequestId),
          eq(paymentsTable.userId, req.user!.userId),
        ),
      )
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    try {
      const status = await paymentService.checkPaymentStatus(checkoutRequestId);
      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Status check failed";
      res.status(502).json({ error: message });
    }
  },
);

/**
 * M-Pesa STK callback — intentionally unauthenticated (called by Safaricom).
 *
 * Security model: we validate structural integrity of the payload and match
 * against CheckoutRequestID records we created ourselves.  Unrecognised IDs
 * are silently accepted (200 OK) to prevent Safaricom from retrying forever.
 *
 * We respond 200 immediately and process asynchronously so the response is
 * always delivered before our DB work could time out.
 */
router.post("/mpesa/callback", (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  if (!mpesaService.isValidCallback(req.body)) {
    logger.warn({ body: req.body }, "Invalid M-Pesa callback payload received");
    return;
  }

  void paymentService
    .handleCallback(req.body)
    .then(async (result) => {
      if (!result.success || !result.paymentId) return;

      const [payment] = await db
        .select({ userId: paymentsTable.userId })
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.paymentId))
        .limit(1)
        .catch(() => [null]);

      if (!payment) return;

      await db
        .insert(auditLogsTable)
        .values({
          action: "payment_completed",
          userId: payment.userId,
          targetId: result.paymentId,
          targetType: "payment",
          metadata: {
            subscriptionId: result.subscriptionId,
            mpesaRef: result.mpesaRef,
          },
        })
        .catch(() => {});

      if (result.subscriptionId) {
        await db
          .insert(auditLogsTable)
          .values({
            action: "subscription_activated",
            userId: payment.userId,
            targetId: result.subscriptionId,
            targetType: "subscription",
            metadata: { mpesaRef: result.mpesaRef, paymentId: result.paymentId },
          })
          .catch(() => {});
      }
    })
    .catch((err) => {
      logger.error({ err }, "M-Pesa callback processing error");
    });
});

export default router;
