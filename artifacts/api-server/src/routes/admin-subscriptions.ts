import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  plansTable,
  adminSettingsTable,
  paymentsTable,
  usersTable,
} from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { subscriptionService } from "../services/subscription.service.js";
import { subscriptionScheduler } from "../services/subscription.scheduler.js";
import { logAudit } from "../lib/audit.js";
import type { AuthRequest } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const UpdateSettingsSchema = z.object({
  subscriptionFeePerDay: z.number().positive().optional(),
  minimumSubscriptionDays: z.number().int().min(1).optional(),
  maximumSubscriptionDays: z.number().int().min(1).optional(),
  winRate: z.number().min(0).max(100).optional(),
  totalTradesCount: z.number().int().min(0).optional(),
  uptimePercent: z.number().min(0).max(100).optional(),
});

const CreatePlanSchema = z.object({
  name: z.string().min(1),
  pricePerDay: z.number().positive(),
  minimumDays: z.number().int().min(1).default(7),
  maximumDays: z.number().int().min(1).default(365),
  features: z.array(z.string()).default([]),
});

const UpdatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  pricePerDay: z.number().positive().optional(),
  minimumDays: z.number().int().min(1).optional(),
  maximumDays: z.number().int().min(1).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const AdminActivateSchema = z.object({
  subscriptionId: z.string().uuid(),
});

// ─── Admin Settings ───────────────────────────────────────────────────────────

router.get("/settings", async (_req, res) => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, "default"))
    .limit(1);

  res.json({
    subscriptionFeePerDay: settings?.subscriptionFeePerDay ?? "100",
    minimumSubscriptionDays: settings?.minimumSubscriptionDays ?? 7,
    maximumSubscriptionDays: settings?.maximumSubscriptionDays ?? 365,
    copyFactoryStrategyId: settings?.copyFactoryStrategyId ?? null,
    masterMt5Login: settings?.masterMt5Login ?? null,
  });
});

router.patch(
  "/settings",
  validateBody(UpdateSettingsSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof UpdateSettingsSchema>;

    if (
      body.minimumSubscriptionDays !== undefined &&
      body.maximumSubscriptionDays !== undefined &&
      body.minimumSubscriptionDays > body.maximumSubscriptionDays
    ) {
      res.status(400).json({ error: "minimumSubscriptionDays cannot exceed maximumSubscriptionDays" });
      return;
    }

    const updated = await subscriptionService.upsertSettings({
      ...body,
      updatedBy: req.user!.userId,
    });

    await logAudit("admin_settings_updated", req, {
      userId: req.user!.userId,
      targetId: "settings",
      targetType: "admin_settings",
      metadata: body,
    });

    res.json({
      subscriptionFeePerDay: updated.subscriptionFeePerDay,
      minimumSubscriptionDays: updated.minimumSubscriptionDays,
      maximumSubscriptionDays: updated.maximumSubscriptionDays,
    });
  },
);

router.get("/subscription-settings", async (_req, res) => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, "default"))
    .limit(1);

  res.json({
    settings: settings ?? null,
    subscriptionFeePerDay: Number(settings?.subscriptionFeePerDay ?? 100),
    minimumSubscriptionDays: settings?.minimumSubscriptionDays ?? 7,
    maximumSubscriptionDays: settings?.maximumSubscriptionDays ?? 365,
    winRate: parseFloat(settings?.winRate ?? "74.0"),
    totalTradesCount: settings?.totalTradesCount ?? 50000,
    uptimePercent: parseFloat(settings?.uptimePercent ?? "99.9"),
  });
});

router.put(
  "/subscription-settings",
  validateBody(UpdateSettingsSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof UpdateSettingsSchema>;

    if (
      body.minimumSubscriptionDays !== undefined &&
      body.maximumSubscriptionDays !== undefined &&
      body.minimumSubscriptionDays > body.maximumSubscriptionDays
    ) {
      res.status(400).json({ error: "minimumSubscriptionDays cannot exceed maximumSubscriptionDays" });
      return;
    }

    const updated = await subscriptionService.upsertSettings({
      ...body,
      updatedBy: req.user!.userId,
    });

    await logAudit("admin_settings_updated", req, {
      userId: req.user!.userId,
      targetId: "subscription-settings",
      targetType: "admin_settings",
      metadata: body,
    });

    res.json({ message: "Subscription settings updated", settings: updated });
  },
);

// ─── Plan Management ──────────────────────────────────────────────────────────

router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .orderBy(plansTable.pricePerDay);

  res.json({ plans });
});

router.post("/plans", validateBody(CreatePlanSchema), async (req: AuthRequest, res) => {
  const body = req.body as z.infer<typeof CreatePlanSchema>;

  if (body.minimumDays > body.maximumDays) {
    res.status(400).json({ error: "minimumDays cannot exceed maximumDays" });
    return;
  }

  const [plan] = await db
    .insert(plansTable)
    .values({
      name: body.name,
      pricePerDay: String(body.pricePerDay),
      minimumDays: body.minimumDays,
      maximumDays: body.maximumDays,
      features: body.features,
      isActive: true,
    })
    .returning();

  await logAudit("admin_plan_created", req, {
    userId: req.user!.userId,
    targetId: plan.id,
    targetType: "plan",
    metadata: body,
  });

  res.status(201).json({ plan });
});

router.put("/plans/:id", validateBody(UpdatePlanSchema), async (req: AuthRequest, res) => {
  const body = req.body as z.infer<typeof UpdatePlanSchema>;

  const [existing] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, String(req.params["id"])))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const minDays = body.minimumDays ?? existing.minimumDays;
  const maxDays = body.maximumDays ?? existing.maximumDays;

  if (minDays > maxDays) {
    res.status(400).json({ error: "minimumDays cannot exceed maximumDays" });
    return;
  }

  const [updated] = await db
    .update(plansTable)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.pricePerDay !== undefined && { pricePerDay: String(body.pricePerDay) }),
      ...(body.minimumDays !== undefined && { minimumDays: body.minimumDays }),
      ...(body.maximumDays !== undefined && { maximumDays: body.maximumDays }),
      ...(body.features !== undefined && { features: body.features }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(plansTable.id, String(req.params["id"])))
    .returning();

  await logAudit("admin_plan_updated", req, {
    userId: req.user!.userId,
    targetId: String(req.params["id"]),
    targetType: "plan",
    metadata: body,
  });

  res.json({ plan: updated });
});

router.delete("/plans/:id", async (req: AuthRequest, res) => {
  const planId = String(req.params["id"]);
  const [plan] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(eq(plansTable.id, planId))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  await db
    .update(plansTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(plansTable.id, planId));

  await logAudit("admin_plan_updated", req, {
    userId: req.user!.userId,
    targetId: planId,
    targetType: "plan",
    metadata: { action: "deactivated" },
  });

  res.json({ message: "Plan deactivated" });
});

// ─── Subscription Oversight ───────────────────────────────────────────────────

router.get("/subscriptions/stats", async (_req, res) => {
  const stats = await subscriptionService.getStats();
  res.json(stats);
});

router.get("/subscriptions", async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const limit = parseInt(req.query["limit"] as string, 10) || 50;
  const offset = parseInt(req.query["offset"] as string, 10) || 0;

  const result = await subscriptionService.listAllSubscriptions({ status, limit, offset });
  res.json(result);
});

router.get("/subscriptions/:id", async (req, res) => {
  const [row] = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        phone: usersTable.phone,
      },
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .leftJoin(usersTable, eq(usersTable.id, subscriptionsTable.userId))
    .where(eq(subscriptionsTable.id, req.params.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.subscriptionId, req.params.id))
    .orderBy(desc(paymentsTable.createdAt));

  res.json({ ...row, payments });
});

router.post("/subscriptions/:id/expire", async (req: AuthRequest, res) => {
  try {
    await subscriptionService.expireSubscription(String(req.params["id"]));

    await logAudit("subscription_expired", req, {
      userId: req.user!.userId,
      targetId: String(req.params["id"]),
      targetType: "subscription",
      metadata: { action: "admin_force_expire" },
    });

    res.json({ message: "Subscription expired and copy trading disabled" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Expiry failed";
    res.status(400).json({ error: message });
  }
});

router.post("/subscriptions/:id/cancel", async (req: AuthRequest, res) => {
  try {
    await subscriptionService.cancelSubscription({
      subscriptionId: String(req.params["id"]),
      userId: "",
      adminOverride: true,
    });

    await logAudit("subscription_cancelled", req, {
      userId: req.user!.userId,
      targetId: String(req.params["id"]),
      targetType: "subscription",
      metadata: { action: "admin_cancel" },
    });

    res.json({ message: "Subscription cancelled and copy trading disabled" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cancellation failed";
    res.status(400).json({ error: message });
  }
});

router.post(
  "/subscriptions/activate",
  validateBody(AdminActivateSchema),
  async (req: AuthRequest, res) => {
    const { subscriptionId } = req.body as z.infer<typeof AdminActivateSchema>;

    try {
      await subscriptionService.activateSubscription(subscriptionId);

      await logAudit("subscription_activated", req, {
        userId: req.user!.userId,
        targetId: subscriptionId,
        targetType: "subscription",
        metadata: { action: "admin_activate" },
      });

      res.json({ message: "Subscription activated and copy trading enabled" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Activation failed";
      res.status(400).json({ error: message });
    }
  },
);

router.post("/subscriptions/process-expired", async (req: AuthRequest, res) => {
  try {
    const result = await subscriptionScheduler.runNow();

    await logAudit("admin_settings_updated", req, {
      userId: req.user!.userId,
      targetId: "subscription-expiry-batch",
      targetType: "system",
      metadata: { action: "process_expired_subscriptions", ...result },
    });

    res.json({ message: "Expiry batch complete", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Batch failed";
    res.status(502).json({ error: message });
  }
});

export default router;
