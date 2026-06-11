import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  db,
  mt5AccountsTable,
  metaApiAccountsTable,
  copyFactoryRelationshipsTable,
  adminSettingsTable,
} from "@workspace/db";
import { type AuthRequest } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validate.js";
import { synchronizationService } from "../services/synchronization.service.js";
import { logAudit } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import {
  AccountDeploymentQueue,
  CopyFactoryQueue,
} from "../queues/index.js";

const router: IRouter = Router();

const RegisterMt5Schema = z.object({
  login: z.string().min(1),
  server: z.string().min(1),
  broker: z.string().min(1),
  region: z.enum(["london", "new-york", "singapore", "sydney", "tokyo"]).optional(),
});

const DeployMt5Schema = z.object({
  password: z.string().min(1),
  multiplier: z.number().min(0.01).max(100).optional(),
});

const RegisterCopyFactorySchema = z.object({
  multiplier: z.number().min(0.01).max(100).optional(),
});

// ── GET /mt5/accounts ──────────────────────────────────────────────────────────
router.get("/accounts", async (req: AuthRequest, res) => {
  const accounts = await db
    .select({ mt5: mt5AccountsTable, metaApi: metaApiAccountsTable })
    .from(mt5AccountsTable)
    .leftJoin(metaApiAccountsTable, eq(metaApiAccountsTable.mt5AccountId, mt5AccountsTable.id))
    .where(and(eq(mt5AccountsTable.userId, req.user!.userId), eq(mt5AccountsTable.isMaster, false)));

  res.json({ accounts });
});

// ── POST /mt5/accounts ─────────────────────────────────────────────────────────
router.post(
  "/accounts",
  validateBody(RegisterMt5Schema),
  async (req: AuthRequest, res) => {
    const { login, server, broker, region } = req.body as z.infer<typeof RegisterMt5Schema>;

    const [mt5] = await db
      .insert(mt5AccountsTable)
      .values({
        userId: req.user!.userId,
        login,
        server,
        broker,
        region: region ?? "london",
        isMaster: false,
        deploymentStatus: "not_deployed",
        synchronizationStatus: "not_synced",
      })
      .returning();

    await logAudit("mt5_account_added", req, {
      userId: req.user!.userId,
      targetId: mt5.id,
      targetType: "mt5_account",
      metadata: { login, server, broker },
    });

    res.status(201).json({ mt5Account: mt5 });
  },
);

// ── GET /mt5/accounts/:id ──────────────────────────────────────────────────────
router.get("/accounts/:id", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(and(eq(mt5AccountsTable.id, String(req.params["id"])), eq(mt5AccountsTable.userId, req.user!.userId)))
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [metaApiRecord] = mt5.metaApiAccountId
    ? await db
        .select()
        .from(metaApiAccountsTable)
        .where(eq(metaApiAccountsTable.metaApiId, mt5.metaApiAccountId))
        .limit(1)
    : [null];

  const relationships = await db
    .select()
    .from(copyFactoryRelationshipsTable)
    .where(eq(copyFactoryRelationshipsTable.subscriberUserId, req.user!.userId));

  res.json({
    mt5Account: mt5,
    metaApiAccount: metaApiRecord ?? null,
    copyFactoryRelationships: relationships,
  });
});

// ── POST /mt5/accounts/:id/deploy ─────────────────────────────────────────────
/**
 * Enqueues an AccountDeploymentQueue job and returns 202 Accepted immediately.
 *
 * MetaApi provisioning can take 30–120 seconds — running it inline would
 * block the HTTP request until timeouts occur. The queue gives us:
 *   - Retry with exponential back-off (3 attempts, 10 s base delay)
 *   - Concurrency cap (5 parallel deploys)
 *   - Dead-letter visibility on failure
 *
 * Poll GET /mt5/accounts/:id/status or GET /mt5/accounts/:id to check progress.
 */
router.post(
  "/accounts/:id/deploy",
  validateBody(DeployMt5Schema),
  async (req: AuthRequest, res) => {
    const { password, multiplier } = req.body as z.infer<typeof DeployMt5Schema>;

    const [mt5] = await db
      .select()
      .from(mt5AccountsTable)
      .where(
        and(
          eq(mt5AccountsTable.id, String(req.params["id"])),
          eq(mt5AccountsTable.userId, req.user!.userId),
          eq(mt5AccountsTable.isMaster, false),
        ),
      )
      .limit(1);

    if (!mt5) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (mt5.deploymentStatus === "deployed") {
      res.status(409).json({ error: "Account is already deployed" });
      return;
    }

    if (mt5.deploymentStatus === "deploying") {
      res.status(409).json({
        error: "Deployment already in progress",
        hint: "Poll GET /mt5/accounts/:id/status to track progress",
      });
      return;
    }

    await db
      .update(mt5AccountsTable)
      .set({ deploymentStatus: "deploying", updatedAt: new Date() })
      .where(eq(mt5AccountsTable.id, mt5.id));

    const job = await AccountDeploymentQueue.add("deploy-subscriber", {
      type: "deploy-subscriber",
      mt5AccountDbId: mt5.id,
      userId: req.user!.userId,
      login: mt5.login,
      password,
      server: mt5.server,
      broker: mt5.broker,
      region: mt5.region ?? undefined,
      multiplier: multiplier ?? 1.0,
    });

    logger.info(
      { jobId: job.id, mt5AccountId: mt5.id, userId: req.user!.userId, login: mt5.login },
      "[MT5Route] Deployment job enqueued",
    );

    res.status(202).json({
      message: "Deployment queued — processing in background",
      jobId: job.id,
      mt5AccountId: mt5.id,
      hint: "Poll GET /mt5/accounts/:id/status to track progress",
    });
  },
);

// ── GET /mt5/accounts/:id/status ──────────────────────────────────────────────
router.get("/accounts/:id/status", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select({ id: mt5AccountsTable.id })
    .from(mt5AccountsTable)
    .where(and(eq(mt5AccountsTable.id, String(req.params["id"])), eq(mt5AccountsTable.userId, req.user!.userId)))
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  try {
    const status = await synchronizationService.checkStatus(mt5.id);
    res.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status check failed";
    res.status(502).json({ error: message });
  }
});

// ── POST /mt5/accounts/:id/copyfactory ────────────────────────────────────────
/**
 * Enqueues a CopyFactoryQueue job to register/re-register the subscriber.
 * Returns 202 immediately — the CopyFactory PUT may take seconds.
 */
router.post(
  "/accounts/:id/copyfactory",
  validateBody(RegisterCopyFactorySchema),
  async (req: AuthRequest, res) => {
    const { multiplier } = req.body as z.infer<typeof RegisterCopyFactorySchema>;

    const [mt5] = await db
      .select()
      .from(mt5AccountsTable)
      .where(
        and(
          eq(mt5AccountsTable.id, String(req.params["id"])),
          eq(mt5AccountsTable.userId, req.user!.userId),
          eq(mt5AccountsTable.isMaster, false),
        ),
      )
      .limit(1);

    if (!mt5) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (!mt5.metaApiAccountId) {
      res.status(400).json({ error: "Account must be deployed to MetaApi first" });
      return;
    }

    const [settings] = await db
      .select({ copyFactoryStrategyId: adminSettingsTable.copyFactoryStrategyId })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, "default"))
      .limit(1);

    if (!settings?.copyFactoryStrategyId) {
      res.status(400).json({ error: "Master strategy not configured" });
      return;
    }

    const job = await CopyFactoryQueue.add("register-subscriber", {
      type: "register-subscriber",
      userId: req.user!.userId,
      metaApiAccountId: mt5.metaApiAccountId,
      multiplier: multiplier ?? 1.0,
    });

    logger.info(
      { jobId: job.id, userId: req.user!.userId, metaApiAccountId: mt5.metaApiAccountId },
      "[MT5Route] CopyFactory registration job enqueued",
    );

    await logAudit("copy_factory_subscriber_added", req, {
      userId: req.user!.userId,
      targetId: mt5.id,
      targetType: "mt5_account",
      metadata: { strategyId: settings.copyFactoryStrategyId, multiplier, jobId: job.id },
    });

    res.status(202).json({
      message: "CopyFactory registration queued — processing in background",
      jobId: job.id,
      metaApiAccountId: mt5.metaApiAccountId,
    });
  },
);

// ── DELETE /mt5/accounts/:id ───────────────────────────────────────────────────
/**
 * Enqueues an AccountDeploymentQueue removal job and returns 202 Accepted.
 * MetaApi undeploy + delete is a two-step async operation.
 */
router.delete("/accounts/:id", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(
      and(
        eq(mt5AccountsTable.id, String(req.params["id"])),
        eq(mt5AccountsTable.userId, req.user!.userId),
        eq(mt5AccountsTable.isMaster, false),
      ),
    )
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const job = await AccountDeploymentQueue.add("remove-account", {
    type: "remove-account",
    mt5AccountDbId: mt5.id,
    userId: req.user!.userId,
    login: mt5.login,
  });

  logger.info(
    { jobId: job.id, mt5AccountId: mt5.id, userId: req.user!.userId, login: mt5.login },
    "[MT5Route] Account removal job enqueued",
  );

  await logAudit("mt5_account_removed", req, {
    userId: req.user!.userId,
    targetId: mt5.id,
    targetType: "mt5_account",
    metadata: { login: mt5.login, jobId: job.id },
  });

  res.status(202).json({
    message: "Account removal queued — processing in background",
    jobId: job.id,
    mt5AccountId: mt5.id,
  });
});

export default router;
