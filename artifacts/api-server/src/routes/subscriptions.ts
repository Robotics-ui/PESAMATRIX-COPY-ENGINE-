import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  plansTable,
  adminSettingsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validate.js";
import { subscriptionService } from "../services/subscription.service.js";
import { logAudit } from "../lib/audit.js";
import type { AuthRequest } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const PreviewSchema = z.object({
  planId: z.string().uuid(),
  days: z.number().int().min(1),
});

const RenewSchema = z.object({
  planId: z.string().uuid(),
  days: z.number().int().min(1),
  phone: z.string().min(9).max(15).optional(),
});

const ValidateSchema = z.object({
  planId: z.string().uuid(),
  days: z.number().int().min(1),
});

/**
 * Public: subscription settings needed to configure the days slider.
 * Returns effective min/max days and fee per day.
 */
router.get("/settings", async (_req, res) => {
  const [settings] = await db
    .select({
      subscriptionFeePerDay: adminSettingsTable.subscriptionFeePerDay,
      minimumSubscriptionDays: adminSettingsTable.minimumSubscriptionDays,
      maximumSubscriptionDays: adminSettingsTable.maximumSubscriptionDays,
    })
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, "default"))
    .limit(1);

  res.json({
    subscriptionFeePerDay: Number(settings?.subscriptionFeePerDay ?? 100),
    minimumSubscriptionDays: settings?.minimumSubscriptionDays ?? 7,
    maximumSubscriptionDays: settings?.maximumSubscriptionDays ?? 365,
  });
});

/**
 * Public: list active plans with slider-ready metadata.
 */
router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.pricePerDay);

  const adminSettings = await subscriptionService.getSettings();

  const enriched = plans.map((plan) => ({
    ...plan,
    pricePerDay: Number(plan.pricePerDay),
    effectiveMinDays: Math.max(plan.minimumDays, adminSettings.minimumSubscriptionDays),
    effectiveMaxDays: Math.min(plan.maximumDays, adminSettings.maximumSubscriptionDays),
  }));

  res.json({ plans: enriched });
});

/**
 * Authenticated: calculate pricing preview for the slider — no writes.
 * Query params: planId, days
 */
router.get("/preview", authenticate, async (req: AuthRequest, res) => {
  const planId = req.query["planId"] as string;
  const days = parseInt(req.query["days"] as string, 10);

  if (!planId || isNaN(days)) {
    res.status(400).json({ error: "planId and days are required" });
    return;
  }

  try {
    const preview = await subscriptionService.getPricingPreview({
      userId: req.user!.userId,
      planId,
      days,
    });
    res.json(preview);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    res.status(400).json({ error: message });
  }
});

/**
 * Authenticated: validate days + plan combo and return effective constraints.
 * Used for real-time slider feedback before the user submits.
 */
router.post("/validate", authenticate, validateBody(ValidateSchema), async (req: AuthRequest, res) => {
  const { planId, days } = req.body as z.infer<typeof ValidateSchema>;
  const result = await subscriptionService.validateRequest(planId, days);
  res.json(result);
});

/**
 * Authenticated: all subscriptions for the current user.
 */
router.get("/", authenticate, async (req: AuthRequest, res) => {
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

/**
 * Authenticated: get the user's active subscription with daysRemaining + CopyFactory status.
 */
router.get("/active", authenticate, async (req: AuthRequest, res) => {
  const info = await subscriptionService.getActiveSubscription(req.user!.userId);
  if (!info) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }
  res.json({ subscription: info });
});

/**
 * Authenticated: get a specific subscription.
 */
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const [row] = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(
      and(
        eq(subscriptionsTable.id, req.params.id),
        eq(subscriptionsTable.userId, req.user!.userId),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  res.json(row);
});

/**
 * Authenticated: initiate a renewal payment for an existing subscription.
 * Creates a new pending subscription that will start from the current endDate.
 */
router.post("/renew", authenticate, validateBody(RenewSchema), async (req: AuthRequest, res) => {
  const body = req.body as z.infer<typeof RenewSchema>;

  try {
    const result = await subscriptionService.initiateRenewal({
      userId: req.user!.userId,
      planId: body.planId,
      days: body.days,
      phone: body.phone ?? "",
    });

    await logAudit("payment_initiated", req, {
      userId: req.user!.userId,
      targetId: result.paymentId,
      targetType: "payment",
      metadata: {
        type: "renewal",
        subscriptionId: result.subscriptionId,
        amount: result.amount,
        renewalStartDate: result.renewalStartDate,
        checkoutRequestId: result.checkoutRequestId,
      },
    });

    res.status(201).json({
      message: result.customerMessage,
      paymentId: result.paymentId,
      subscriptionId: result.subscriptionId,
      checkoutRequestId: result.checkoutRequestId,
      amount: result.amount,
      renewalStartDate: result.renewalStartDate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Renewal failed";
    res.status(400).json({ error: message });
  }
});

/**
 * Authenticated: cancel a subscription.
 * Immediately detaches CopyFactory and marks the subscription cancelled.
 */
router.post("/:id/cancel", authenticate, async (req: AuthRequest, res) => {
  try {
    await subscriptionService.cancelSubscription({
      subscriptionId: req.params.id,
      userId: req.user!.userId,
    });

    await logAudit("subscription_cancelled", req, {
      userId: req.user!.userId,
      targetId: req.params.id,
      targetType: "subscription",
    });

    res.json({ message: "Subscription cancelled and copy trading disabled" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cancellation failed";
    res.status(400).json({ error: message });
  }
});

export default router;
