import { eq } from "drizzle-orm";
import { db, mt5AccountsTable, metaApiAccountsTable, adminSettingsTable } from "@workspace/db";
import { metaApiService } from "./metaapi.service.js";
import { copyFactoryService } from "./copyfactory.service.js";
import { subscriberService } from "./subscriber.service.js";
import { logger } from "../lib/logger.js";

const MASTER_SETTINGS_KEY = "default";
const STRATEGY_PREFIX = "pesamatrix-master";

function generateStrategyId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${STRATEGY_PREFIX}-${suffix}`;
}

function mapMetaApiState(state: string): "created" | "provisioning" | "deployed" | "undeployed" | "error" {
  switch (state) {
    case "CREATED": return "created";
    case "DEPLOYING": return "provisioning";
    case "DEPLOYED": return "deployed";
    case "UNDEPLOYING": return "undeployed";
    case "UNDEPLOYED": return "undeployed";
    case "ERROR": return "error";
    default: return "created";
  }
}

function mapDeploymentStatus(state: string): "not_deployed" | "deploying" | "deployed" | "failed" | "removed" {
  switch (state) {
    case "CREATED": return "not_deployed";
    case "DEPLOYING": return "deploying";
    case "DEPLOYED": return "deployed";
    case "UNDEPLOYING": return "not_deployed";
    case "UNDEPLOYED": return "not_deployed";
    case "ERROR": return "failed";
    default: return "not_deployed";
  }
}

function mapSyncStatus(connectionStatus: string, state: string): "not_synced" | "synchronizing" | "synchronized" | "out_of_sync" | "error" {
  if (state === "ERROR") return "error";
  if (state !== "DEPLOYED") return "not_synced";
  switch (connectionStatus) {
    case "CONNECTED": return "synchronized";
    case "DISCONNECTED": return "out_of_sync";
    case "DISCONNECTED_FROM_BROKER": return "out_of_sync";
    default: return "synchronizing";
  }
}

export class DeploymentService {
  async deployMasterAccount(params: {
    mt5AccountDbId: string;
    login: string;
    password: string;
    server: string;
    broker: string;
    region?: string;
  }) {
    const { mt5AccountDbId, login, password, server, broker, region } = params;

    await db
      .update(mt5AccountsTable)
      .set({ deploymentStatus: "deploying", updatedAt: new Date() })
      .where(eq(mt5AccountsTable.id, mt5AccountDbId));

    try {
      const metaApiAccount = await metaApiService.createAccount({
        login,
        password,
        name: `Master-${login}`,
        server,
        broker,
        region: region ?? "london",
        platform: "mt5",
      });

      const [metaApiDbRecord] = await db
        .insert(metaApiAccountsTable)
        .values({
          userId: (await db.select({ userId: mt5AccountsTable.userId })
            .from(mt5AccountsTable)
            .where(eq(mt5AccountsTable.id, mt5AccountDbId))
            .limit(1))[0].userId,
          mt5AccountId: mt5AccountDbId,
          metaApiId: metaApiAccount.id,
          state: "provisioning",
          isMaster: true,
          region: region ?? "london",
        })
        .returning();

      await db
        .update(mt5AccountsTable)
        .set({ metaApiAccountId: metaApiAccount.id, updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));

      await metaApiService.deployAccount(metaApiAccount.id);

      const strategyId = generateStrategyId();
      await copyFactoryService.createStrategy(
        strategyId,
        metaApiAccount.id,
        `PesaMatrix Master ${login}`,
      );

      const masterUserId = metaApiDbRecord.userId;

      await db
        .update(mt5AccountsTable)
        .set({ deploymentStatus: "deployed", updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));

      await db
        .update(metaApiAccountsTable)
        .set({ state: "deployed", updatedAt: new Date() })
        .where(eq(metaApiAccountsTable.id, metaApiDbRecord.id));

      await db
        .insert(adminSettingsTable)
        .values({
          key: MASTER_SETTINGS_KEY,
          masterMt5Login: login,
          masterMetaApiAccountId: metaApiAccount.id,
          copyFactoryStrategyId: strategyId,
          updatedBy: masterUserId,
        })
        .onConflictDoUpdate({
          target: adminSettingsTable.key,
          set: {
            masterMt5Login: login,
            masterMetaApiAccountId: metaApiAccount.id,
            copyFactoryStrategyId: strategyId,
            updatedAt: new Date(),
            updatedBy: masterUserId,
          },
        });

      return {
        metaApiAccountId: metaApiAccount.id,
        copyFactoryStrategyId: strategyId,
        state: metaApiAccount.state,
      };
    } catch (err) {
      logger.error({ err }, "Master account deployment failed");
      await db
        .update(mt5AccountsTable)
        .set({ deploymentStatus: "failed", updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));
      throw err;
    }
  }

  async deploySubscriberAccount(params: {
    mt5AccountDbId: string;
    userId: string;
    login: string;
    password: string;
    server: string;
    broker: string;
    region?: string;
    multiplier?: number;
  }) {
    const { mt5AccountDbId, userId, login, password, server, broker, region, multiplier } = params;

    const [settings] = await db
      .select({
        copyFactoryStrategyId: adminSettingsTable.copyFactoryStrategyId,
        masterMetaApiAccountId: adminSettingsTable.masterMetaApiAccountId,
      })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY))
      .limit(1);

    if (!settings?.copyFactoryStrategyId) {
      throw new Error("Master account and CopyFactory strategy not configured yet");
    }

    await db
      .update(mt5AccountsTable)
      .set({ deploymentStatus: "deploying", updatedAt: new Date() })
      .where(eq(mt5AccountsTable.id, mt5AccountDbId));

    try {
      const metaApiAccount = await metaApiService.createAccount({
        login,
        password,
        name: `Subscriber-${login}`,
        server,
        broker,
        region: region ?? "london",
        platform: "mt5",
      });

      const [metaApiDbRecord] = await db
        .insert(metaApiAccountsTable)
        .values({
          userId,
          mt5AccountId: mt5AccountDbId,
          metaApiId: metaApiAccount.id,
          state: "provisioning",
          isMaster: false,
          region: region ?? "london",
        })
        .returning();

      await db
        .update(mt5AccountsTable)
        .set({ metaApiAccountId: metaApiAccount.id, updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));

      await metaApiService.deployAccount(metaApiAccount.id);

      await db
        .update(mt5AccountsTable)
        .set({ deploymentStatus: "deployed", updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));

      await db
        .update(metaApiAccountsTable)
        .set({ state: "deployed", updatedAt: new Date() })
        .where(eq(metaApiAccountsTable.id, metaApiDbRecord.id));

      const cfResult = await subscriberService.registerSubscriber({
        userId,
        metaApiAccountId: metaApiAccount.id,
        multiplier: multiplier ?? 1.0,
      });

      return {
        metaApiAccountId: metaApiAccount.id,
        copyFactoryStrategyId: cfResult.strategyId,
        copyFactoryRelationshipId: cfResult.relationshipId,
        state: metaApiAccount.state,
      };
    } catch (err) {
      logger.error({ err }, "Subscriber account deployment failed");
      await db
        .update(mt5AccountsTable)
        .set({ deploymentStatus: "failed", updatedAt: new Date() })
        .where(eq(mt5AccountsTable.id, mt5AccountDbId));
      throw err;
    }
  }

  async removeAccount(mt5AccountDbId: string): Promise<void> {
    const [mt5] = await db
      .select()
      .from(mt5AccountsTable)
      .where(eq(mt5AccountsTable.id, mt5AccountDbId))
      .limit(1);

    if (!mt5) throw new Error("MT5 account not found");

    // Clean up MetaApi remotely (best-effort — don't block delete on errors)
    if (mt5.metaApiAccountId) {
      try {
        await metaApiService.undeployAccount(mt5.metaApiAccountId);
        await metaApiService.deleteAccount(mt5.metaApiAccountId);
      } catch (err) {
        logger.warn({ err }, "MetaApi cleanup error during removal — continuing with local delete");
      }
    }

    // Delete metaApi DB records linked to this account
    await db
      .delete(metaApiAccountsTable)
      .where(eq(metaApiAccountsTable.mt5AccountId, mt5AccountDbId));

    // Clear admin settings so a new master can be registered
    await db
      .delete(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY));

    // Hard-delete the MT5 account row — not a soft "removed" status
    await db
      .delete(mt5AccountsTable)
      .where(eq(mt5AccountsTable.id, mt5AccountDbId));

    logger.info({ mt5AccountDbId, login: mt5.login }, "[Deployment] Master account fully removed from DB");
  }
}

export const deploymentService = new DeploymentService();
