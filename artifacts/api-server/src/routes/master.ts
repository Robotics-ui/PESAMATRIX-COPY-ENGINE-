import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  mt5AccountsTable,
  metaApiAccountsTable,
  adminSettingsTable,
  copyFactoryRelationshipsTable,
} from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { deploymentService } from "../services/deployment.service.js";
import { synchronizationService } from "../services/synchronization.service.js";
import { copyFactoryService } from "../services/copyfactory.service.js";
import { metaApiService } from "../services/metaapi.service.js";
import { logAudit } from "../lib/audit.js";
import type { AuthRequest } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const MASTER_KEY = "default";

const RegisterMasterSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  server: z.string().min(1),
  broker: z.string().min(1),
  region: z.enum(["london", "new-york", "singapore", "sydney", "tokyo"]).optional(),
});

router.post(
  "/master-account",
  validateBody(RegisterMasterSchema),
  async (req: AuthRequest, res) => {
    const { login, password, server, broker, region } = req.body as z.infer<typeof RegisterMasterSchema>;

    const existing = await db
      .select({ id: mt5AccountsTable.id })
      .from(mt5AccountsTable)
      .where(eq(mt5AccountsTable.isMaster, true))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "A master account is already registered. Remove it first." });
      return;
    }

    const [mt5] = await db
      .insert(mt5AccountsTable)
      .values({
        userId: req.user!.userId,
        login,
        server,
        broker,
        isMaster: true,
        deploymentStatus: "not_deployed",
        synchronizationStatus: "not_synced",
      })
      .returning();

    try {
      const result = await deploymentService.deployMasterAccount({
        mt5AccountDbId: mt5.id,
        login,
        password,
        server,
        broker,
        region,
      });

      await logAudit("mt5_account_added", req, {
        userId: req.user!.userId,
        targetId: mt5.id,
        targetType: "mt5_account",
        metadata: { login, server, broker, isMaster: true, metaApiAccountId: result.metaApiAccountId },
      });

      const [updated] = await db
        .select()
        .from(mt5AccountsTable)
        .where(eq(mt5AccountsTable.id, mt5.id))
        .limit(1);

      res.status(201).json({
        mt5Account: updated,
        metaApiAccountId: result.metaApiAccountId,
        copyFactoryStrategyId: result.copyFactoryStrategyId,
        state: result.state,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      res.status(502).json({ error: message });
    }
  },
);

router.get("/master-account", async (_req, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(eq(mt5AccountsTable.isMaster, true))
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "No master account configured" });
    return;
  }

  const [metaApiRecord] = mt5.metaApiAccountId
    ? await db
        .select()
        .from(metaApiAccountsTable)
        .where(eq(metaApiAccountsTable.metaApiId, mt5.metaApiAccountId))
        .limit(1)
    : [null];

  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, MASTER_KEY))
    .limit(1);

  res.json({ mt5Account: mt5, metaApiAccount: metaApiRecord ?? null, settings: settings ?? null });
});

router.get("/master-account/status", async (_req, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(eq(mt5AccountsTable.isMaster, true))
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "No master account configured" });
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

router.post("/master-account/redeploy", async (_req, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(eq(mt5AccountsTable.isMaster, true))
    .limit(1);

  if (!mt5 || !mt5.metaApiAccountId) {
    res.status(404).json({ error: "No deployed master account found" });
    return;
  }

  try {
    await metaApiService.redeployAccount(mt5.metaApiAccountId);
    await db
      .update(mt5AccountsTable)
      .set({ deploymentStatus: "deploying", updatedAt: new Date() })
      .where(eq(mt5AccountsTable.id, mt5.id));
    res.json({ message: "Redeploy initiated", metaApiAccountId: mt5.metaApiAccountId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Redeploy failed";
    res.status(502).json({ error: message });
  }
});

router.get("/master-account/strategy", async (_req, res) => {
  const [settings] = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, MASTER_KEY))
    .limit(1);

  if (!settings?.copyFactoryStrategyId) {
    res.status(404).json({ error: "CopyFactory strategy not configured" });
    return;
  }

  try {
    const strategy = await copyFactoryService.getStrategy(settings.copyFactoryStrategyId);
    res.json({ strategy, strategyId: settings.copyFactoryStrategyId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Strategy fetch failed";
    res.status(502).json({ error: message });
  }
});

router.delete("/master-account", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(eq(mt5AccountsTable.isMaster, true))
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "No master account found" });
    return;
  }

  try {
    await deploymentService.removeAccount(mt5.id);
    await logAudit("mt5_account_removed", req, {
      userId: req.user!.userId,
      targetId: mt5.id,
      targetType: "mt5_account",
      metadata: { login: mt5.login, isMaster: true },
    });
    res.json({ message: "Master account removed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Removal failed";
    res.status(502).json({ error: message });
  }
});

router.get("/subscribers", async (_req, res) => {
  const relationships = await db.select().from(copyFactoryRelationshipsTable);
  res.json({ relationships });
});

export default router;
