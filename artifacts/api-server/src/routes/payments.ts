import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  paymentsTable,
  subscriptionsTable,
  plansTable,
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
  planId: z.string().uuid().optional(),
  numberOfDays: z.number().int().min(1),
  phone: z.string().min(9).max(15).optional(),
});

const CheckStatusSchema = z.object({
  checkoutRequestId: z.string().min(1),
});

// ── POST /payments/initiate ───────────────────────────────────────────────────
router.post(
  "/initiate",
  authenticate,
  validateBody(InitiatePaymentSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof InitiatePaymentSchema>;

    try {
      const result = await paymentService.initiatePayment({
        userId: req.user!.userId,
        planId: body.planId ?? null,
        numberOfDays: body.numberOfDays,
        phone: body.phone ?? "",
      });

      if (!result.idempotent) {
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
      }

      res.status(result.idempotent ? 200 : 201).json({
        message: result.customerMessage,
        paymentId: result.paymentId,
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.checkoutRequestId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment initiation failed";
      logger.error({ err, userId: req.user!.userId }, "[Route] Payment initiation error");
      res.status(400).json({ error: message });
    }
  },
);

// ── GET /payments/status/:checkoutRequestId ───────────────────────────────────
router.get(
  "/status/:checkoutRequestId",
  authenticate,
  async (req: AuthRequest, res) => {
    const { checkoutRequestId } = req.params;

    try {
      const status = await paymentService.checkPaymentStatus(
        checkoutRequestId as string,
        req.user!.userId,
      );

      if (!status.paymentId) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Status check failed";
      logger.error({ err, checkoutRequestId }, "[Route] Payment status check error");
      const is404 = err instanceof Error && err.message === "Payment not found";
      res.status(is404 ? 404 : 502).json({ error: message });
    }
  },
);

// ── GET /payments/history ─────────────────────────────────────────────────────
router.get("/history", authenticate, async (req: AuthRequest, res) => {
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, req.user!.userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);

  res.json({ payments });
});

// ── GET /payments/plans ───────────────────────────────────────────────────────
router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.pricePerDay);

  res.json({ plans });
});

// ── GET /payments/subscriptions ───────────────────────────────────────────────
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

// ── GET /payments/subscriptions/active ────────────────────────────────────────
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

// ── POST /payments/pay ────────────────────────────────────────────────────────
router.post(
  "/pay",
  authenticate,
  validateBody(InitiatePaymentSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof InitiatePaymentSchema>;

    try {
      const result = await paymentService.initiatePayment({
        userId: req.user!.userId,
        planId: body.planId ?? null,
        numberOfDays: body.numberOfDays,
        phone: body.phone ?? "",
      });

      if (!result.idempotent) {
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
      }

      res.status(result.idempotent ? 200 : 201).json({
        message: result.customerMessage,
        paymentId: result.paymentId,
        subscriptionId: result.subscriptionId,
        checkoutRequestId: result.checkoutRequestId,
        amount: result.amount,
        idempotent: result.idempotent ?? false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment initiation failed";
      logger.error({ err, userId: req.user!.userId }, "[Route] Payment initiation error");
      res.status(400).json({ error: message });
    }
  },
);

// ── GET /payments/payments ────────────────────────────────────────────────────
router.get("/payments", authenticate, async (req: AuthRequest, res) => {
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, req.user!.userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);

  res.json({ payments });
});

// ── GET /payments/payments/:id ────────────────────────────────────────────────
router.get("/payments/:id", authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const payment = await paymentService.getPaymentById(String(id), req.user!.userId);

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  res.json({ payment });
});

// ── POST /payments/status ─────────────────────────────────────────────────────
router.post(
  "/payments/status",
  authenticate,
  validateBody(CheckStatusSchema),
  async (req: AuthRequest, res) => {
    const { checkoutRequestId } = req.body as z.infer<typeof CheckStatusSchema>;

    logger.info(
      { checkoutRequestId, userId: req.user!.userId },
      "[Route] Payment status check requested",
    );

    try {
      const status = await paymentService.checkPaymentStatus(
        checkoutRequestId,
        req.user!.userId,
      );

      if (!status.paymentId) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Status check failed";
      logger.error({ err, checkoutRequestId }, "[Route] Payment status check error");
      res.status(err instanceof Error && err.message === "Payment not found" ? 404 : 502).json({ error: message });
    }
  },
);

// ── POST /payments/mpesa/callback ─────────────────────────────────────────────
router.post("/mpesa/callback", (req, res) => {
  // Respond 200 immediately — Safaricom retries if we take too long
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  // Always log the full raw payload for debugging
  logger.info(
    { fullPayload: JSON.stringify(req.body) },
    "[Callback] M-Pesa callback received (raw)",
  );

  if (!mpesaService.isValidCallback(req.body)) {
    logger.warn({ body: req.body }, "[Callback] Invalid M-Pesa callback payload — discarding");
    return;
  }

  const checkoutRequestId = req.body?.Body?.stkCallback?.CheckoutRequestID ?? "unknown";
  const resultCode = req.body?.Body?.stkCallback?.ResultCode;
  const resultDesc = req.body?.Body?.stkCallback?.ResultDesc ?? "";
  const merchantRequestId = req.body?.Body?.stkCallback?.MerchantRequestID ?? "unknown";

  logger.info(
    { checkoutRequestId, merchantRequestId, resultCode, resultDesc },
    "[Callback] Valid M-Pesa callback received — processing asynchronously",
  );

  void paymentService
    .handleCallback(req.body)
    .then((result) => {
      logger.info(
        {
          checkoutRequestId,
          paymentId: result.paymentId,
          success: result.success,
          mpesaRef: result.mpesaRef,
          message: result.message,
        },
        "[Callback] M-Pesa callback processing complete",
      );
    })
    .catch((err) => {
      logger.error({ err, checkoutRequestId }, "[Callback] M-Pesa callback processing error");
    });
});

export default router;
