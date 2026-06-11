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
import { deploymentService } from "../services/deployment.service.js";
import { synchronizationService } from "../services/synchronization.service.js";
import { copyFactoryService } from "../services/copyfactory.service.js";
import { logAudit } from "../lib/audit.js";

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

router.get("/accounts", async (req: AuthRequest, res) => {
  const accounts = await db
    .select({
      mt5: mt5AccountsTable,
      metaApi: metaApiAccountsTable,
    })
    .from(mt5AccountsTable)
    .leftJoin(
      metaApiAccountsTable,
      eq(metaApiAccountsTable.mt5AccountId, mt5AccountsTable.id),
    )
    .where(
      and(
        eq(mt5AccountsTable.userId, req.user!.userId),
        eq(mt5AccountsTable.isMaster, false),
      ),
    );

  res.json({ accounts });
});

router.post(
  "/accounts",
  validateBody(RegisterMt5Schema),
  async (req: AuthRequest, res) => {
    const { login, server, broker } = req.body as z.infer<typeof RegisterMt5Schema>;

    const [mt5] = await db
      .insert(mt5AccountsTable)
      .values({
        userId: req.user!.userId,
        login,
        server,
        broker,
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

router.get("/accounts/:id", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(
      and(
        eq(mt5AccountsTable.id, req.params.id),
        eq(mt5AccountsTable.userId, req.user!.userId),
      ),
    )
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
          eq(mt5AccountsTable.id, req.params.id),
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

    try {
      const result = await deploymentService.deploySubscriberAccount({
        mt5AccountDbId: mt5.id,
        userId: req.user!.userId,
        login: mt5.login,
        password,
        server: mt5.server,
        broker: mt5.broker,
        multiplier,
      });

      res.json({
        metaApiAccountId: result.metaApiAccountId,
        copyFactoryStrategyId: result.copyFactoryStrategyId,
        copyFactoryRelationshipId: result.copyFactoryRelationshipId,
        state: result.state,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      res.status(502).json({ error: message });
    }
  },
);

router.get("/accounts/:id/status", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select({ id: mt5AccountsTable.id })
    .from(mt5AccountsTable)
    .where(
      and(
        eq(mt5AccountsTable.id, req.params.id),
        eq(mt5AccountsTable.userId, req.user!.userId),
      ),
    )
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
          eq(mt5AccountsTable.id, req.params.id),
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
      .select()
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, "default"))
      .limit(1);

    if (!settings?.copyFactoryStrategyId) {
      res.status(400).json({ error: "Master strategy not configured" });
      return;
    }

    try {
      await copyFactoryService.addSubscriber(
        mt5.metaApiAccountId,
        settings.copyFactoryStrategyId,
        multiplier ?? 1.0,
      );

      const existing = await db
        .select({ id: copyFactoryRelationshipsTable.id })
        .from(copyFactoryRelationshipsTable)
        .where(
          and(
            eq(copyFactoryRelationshipsTable.subscriberUserId, req.user!.userId),
            eq(copyFactoryRelationshipsTable.copyFactoryStrategyId, settings.copyFactoryStrategyId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        const [masterMetaApi] = settings.masterMetaApiAccountId
          ? await db
              .select({ id: metaApiAccountsTable.id })
              .from(metaApiAccountsTable)
              .where(eq(metaApiAccountsTable.metaApiId, settings.masterMetaApiAccountId))
              .limit(1)
          : [null];

        const [metaApiRecord] = await db
          .select({ id: metaApiAccountsTable.id })
          .from(metaApiAccountsTable)
          .where(eq(metaApiAccountsTable.metaApiId, mt5.metaApiAccountId))
          .limit(1);

        await db.insert(copyFactoryRelationshipsTable).values({
          subscriberUserId: req.user!.userId,
          subscriberMetaApiAccountId: metaApiRecord.id,
          masterMetaApiAccountId: masterMetaApi?.id ?? metaApiRecord.id,
          copyFactoryStrategyId: settings.copyFactoryStrategyId,
          copyFactorySubscriberId: mt5.metaApiAccountId,
          status: "active",
          multiplier: String(multiplier ?? 1.0),
          isActive: true,
          activatedAt: new Date(),
        });
      } else {
        await db
          .update(copyFactoryRelationshipsTable)
          .set({
            status: "active",
            isActive: true,
            multiplier: String(multiplier ?? 1.0),
            activatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(copyFactoryRelationshipsTable.id, existing[0].id));
      }

      await logAudit("copy_factory_subscriber_added", req, {
        userId: req.user!.userId,
        targetId: mt5.id,
        targetType: "mt5_account",
        metadata: { strategyId: settings.copyFactoryStrategyId, multiplier },
      });

      res.json({
        message: "Registered with CopyFactory successfully",
        strategyId: settings.copyFactoryStrategyId,
        subscriberAccountId: mt5.metaApiAccountId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CopyFactory registration failed";
      res.status(502).json({ error: message });
    }
  },
);

router.delete("/accounts/:id", async (req: AuthRequest, res) => {
  const [mt5] = await db
    .select()
    .from(mt5AccountsTable)
    .where(
      and(
        eq(mt5AccountsTable.id, req.params.id),
        eq(mt5AccountsTable.userId, req.user!.userId),
        eq(mt5AccountsTable.isMaster, false),
      ),
    )
    .limit(1);

  if (!mt5) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  try {
    await deploymentService.removeAccount(mt5.id);
    await logAudit("mt5_account_removed", req, {
      userId: req.user!.userId,
      targetId: mt5.id,
      targetType: "mt5_account",
      metadata: { login: mt5.login },
    });
    res.json({ message: "Account removed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Removal failed";
    res.status(502).json({ error: message });
  }
});

export default router;
