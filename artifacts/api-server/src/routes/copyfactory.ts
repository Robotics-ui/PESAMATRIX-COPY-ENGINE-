import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  copyFactoryRelationshipsTable,
  metaApiAccountsTable,
  mt5AccountsTable,
} from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { strategyService } from "../services/strategy.service.js";
import { subscriberService } from "../services/subscriber.service.js";
import { relationshipService } from "../services/relationship.service.js";
import { subscriptionScheduler } from "../services/subscription.scheduler.js";
import { logAudit } from "../lib/audit.js";
import type { AuthRequest } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const AttachSubscriberSchema = z.object({
  userId: z.string().uuid(),
  metaApiAccountId: z.string().min(1),
  subscriptionId: z.string().uuid().optional(),
  multiplier: z.number().min(0.01).max(100).optional(),
});

const DetachSubscriberSchema = z.object({
  userId: z.string().uuid(),
  metaApiAccountId: z.string().min(1),
  reason: z.enum(["expired", "cancelled", "manual"]).optional(),
});

const ActivateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().uuid(),
  multiplier: z.number().min(0.01).max(100).optional(),
});

const ExpireSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.enum(["expired", "cancelled"]).optional(),
});

router.get("/copyfactory/strategy", async (_req, res) => {
  const info = await strategyService.getMasterStrategyInfo();
  if (!info) {
    res.status(404).json({ error: "No master strategy configured" });
    return;
  }
  res.json({ strategy: info });
});

router.get("/copyfactory/strategies", async (_req, res) => {
  try {
    const strategies = await strategyService.listStrategies();
    res.json({ strategies });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list strategies";
    res.status(502).json({ error: message });
  }
});

router.get("/copyfactory/subscribers", async (_req, res) => {
  const subscribers = await subscriberService.listActiveSubscribers();
  res.json({ subscribers, count: subscribers.length });
});

router.get("/copyfactory/relationships", async (_req, res) => {
  const relationships = await db
    .select({
      relationship: copyFactoryRelationshipsTable,
      metaApi: metaApiAccountsTable,
      mt5: mt5AccountsTable,
    })
    .from(copyFactoryRelationshipsTable)
    .leftJoin(
      metaApiAccountsTable,
      eq(metaApiAccountsTable.id, copyFactoryRelationshipsTable.subscriberMetaApiAccountId),
    )
    .leftJoin(
      mt5AccountsTable,
      eq(mt5AccountsTable.id, metaApiAccountsTable.mt5AccountId),
    )
    .orderBy(copyFactoryRelationshipsTable.createdAt);

  res.json({ relationships, count: relationships.length });
});

router.get("/copyfactory/relationships/:userId", async (req, res) => {
  const relationships = await relationshipService.getRelationshipForUser(req.params.userId);
  res.json({ relationships });
});

router.post(
  "/copyfactory/subscribers/attach",
  validateBody(AttachSubscriberSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof AttachSubscriberSchema>;

    try {
      const result = await subscriberService.registerSubscriber({
        userId: body.userId,
        metaApiAccountId: body.metaApiAccountId,
        subscriptionId: body.subscriptionId,
        multiplier: body.multiplier ?? 1.0,
      });

      await logAudit("copy_factory_subscriber_added", req, {
        userId: req.user!.userId,
        targetId: body.userId,
        targetType: "user",
        metadata: {
          metaApiAccountId: body.metaApiAccountId,
          strategyId: result.strategyId,
          multiplier: result.multiplier,
          relationshipId: result.relationshipId,
        },
      });

      res.json({
        message: "Subscriber attached to master strategy",
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to attach subscriber";
      res.status(502).json({ error: message });
    }
  },
);

router.post(
  "/copyfactory/subscribers/detach",
  validateBody(DetachSubscriberSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof DetachSubscriberSchema>;

    try {
      await subscriberService.removeSubscriber({
        userId: body.userId,
        metaApiAccountId: body.metaApiAccountId,
        reason: body.reason ?? "manual",
      });

      await logAudit("copy_factory_subscriber_removed", req, {
        userId: req.user!.userId,
        targetId: body.userId,
        targetType: "user",
        metadata: {
          metaApiAccountId: body.metaApiAccountId,
          reason: body.reason,
        },
      });

      res.json({ message: "Subscriber detached from master strategy" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to detach subscriber";
      res.status(502).json({ error: message });
    }
  },
);

router.post(
  "/copyfactory/subscriptions/activate",
  validateBody(ActivateSubscriptionSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof ActivateSubscriptionSchema>;

    try {
      await db
        .update(subscriptionsTable)
        .set({ status: "active", isActive: true, updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, body.subscriptionId));

      const result = await relationshipService.onSubscriptionActivated({
        subscriptionId: body.subscriptionId,
        userId: body.userId,
        multiplier: body.multiplier ?? 1.0,
      });

      await logAudit("subscription_activated", req, {
        userId: req.user!.userId,
        targetId: body.subscriptionId,
        targetType: "subscription",
        metadata: { userId: body.userId, relationshipId: result?.relationshipId },
      });

      res.json({
        message: result
          ? "Subscription activated and subscriber attached"
          : "Subscription activated (subscriber will be attached at deploy time)",
        relationship: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Activation failed";
      res.status(502).json({ error: message });
    }
  },
);

router.post(
  "/copyfactory/subscriptions/expire",
  validateBody(ExpireSubscriptionSchema),
  async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof ExpireSubscriptionSchema>;

    try {
      await db
        .update(subscriptionsTable)
        .set({
          status: body.reason === "cancelled" ? "cancelled" : "expired",
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.id, body.subscriptionId));

      const result = await relationshipService.onSubscriptionExpired({
        subscriptionId: body.subscriptionId,
        userId: body.userId,
        reason: body.reason ?? "expired",
      });

      await logAudit("subscription_expired", req, {
        userId: req.user!.userId,
        targetId: body.subscriptionId,
        targetType: "subscription",
        metadata: { userId: body.userId, reason: body.reason, detached: result.detached },
      });

      res.json({
        message: result.detached
          ? "Subscription expired and subscriber detached"
          : "Subscription expired (no active subscriber account found)",
        detached: result.detached,
        metaApiAccountId: result.metaApiAccountId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Expiry failed";
      res.status(502).json({ error: message });
    }
  },
);

router.post("/copyfactory/subscriptions/process-expired", async (req: AuthRequest, res) => {
  try {
    const result = await subscriptionScheduler.runNow();

    await logAudit("subscription_expiry_batch_run", req, {
      userId: req.user!.userId,
      targetId: req.user!.userId,
      targetType: "system",
      metadata: result,
    });

    res.json({ message: "Expiry processing complete", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Expiry processing failed";
    res.status(502).json({ error: message });
  }
});

router.get("/copyfactory/subscribers/:metaApiAccountId/status", async (req, res) => {
  try {
    const status = await subscriberService.getSubscriberStatus(req.params.metaApiAccountId);
    res.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status check failed";
    res.status(502).json({ error: message });
  }
});

export default router;
