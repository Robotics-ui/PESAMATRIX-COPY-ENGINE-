import { eq } from "drizzle-orm";
import { db, mt5AccountsTable, metaApiAccountsTable } from "@workspace/db";
import { metaApiService } from "./metaapi.service.js";
import { logger } from "../lib/logger.js";

export interface SyncStatusResult {
  metaApiAccountId: string;
  state: string;
  connectionStatus: string | null;
  isSynchronized: boolean;
  deploymentStatus: "not_deployed" | "deploying" | "deployed" | "failed" | "removed";
  synchronizationStatus: "not_synced" | "synchronizing" | "synchronized" | "out_of_sync" | "error";
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

export class SynchronizationService {
  async checkStatus(mt5AccountDbId: string): Promise<SyncStatusResult> {
    const [mt5] = await db
      .select()
      .from(mt5AccountsTable)
      .where(eq(mt5AccountsTable.id, mt5AccountDbId))
      .limit(1);

    if (!mt5) throw new Error("MT5 account not found");

    if (!mt5.metaApiAccountId) {
      return {
        metaApiAccountId: "",
        state: "NOT_DEPLOYED",
        connectionStatus: null,
        isSynchronized: false,
        deploymentStatus: mt5.deploymentStatus as SyncStatusResult["deploymentStatus"],
        synchronizationStatus: mt5.synchronizationStatus as SyncStatusResult["synchronizationStatus"],
      };
    }

    const account = await metaApiService.getAccount(mt5.metaApiAccountId);
    const deploymentStatus = mapDeploymentStatus(account.state);
    const synchronizationStatus = mapSyncStatus(account.connectionStatus, account.state);
    const isSynchronized = metaApiService.isSynchronized(account);

    await db
      .update(mt5AccountsTable)
      .set({
        deploymentStatus,
        synchronizationStatus,
        lastSyncedAt: isSynchronized ? new Date() : mt5.lastSyncedAt,
        updatedAt: new Date(),
      })
      .where(eq(mt5AccountsTable.id, mt5AccountDbId));

    await db
      .update(metaApiAccountsTable)
      .set({
        state: mapMetaApiState(account.state),
        connectionStatus: account.connectionStatus,
        updatedAt: new Date(),
      })
      .where(eq(metaApiAccountsTable.metaApiId, mt5.metaApiAccountId));

    return {
      metaApiAccountId: mt5.metaApiAccountId,
      state: account.state,
      connectionStatus: account.connectionStatus,
      isSynchronized,
      deploymentStatus,
      synchronizationStatus,
    };
  }

  async pollUntilDeployed(
    mt5AccountDbId: string,
    timeoutMs = 120_000,
    intervalMs = 5_000,
  ): Promise<SyncStatusResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const status = await this.checkStatus(mt5AccountDbId);
        if (status.deploymentStatus === "deployed") return status;
        if (status.deploymentStatus === "failed") {
          throw new Error("Account deployment failed on MetaApi");
        }
      } catch (err) {
        logger.warn({ err }, "Poll error — retrying");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error("Timed out waiting for account to deploy");
  }

  async pollUntilSynchronized(
    mt5AccountDbId: string,
    timeoutMs = 180_000,
    intervalMs = 5_000,
  ): Promise<SyncStatusResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const status = await this.checkStatus(mt5AccountDbId);
        if (status.isSynchronized) return status;
        if (status.synchronizationStatus === "error") {
          throw new Error("Synchronization error reported by MetaApi");
        }
      } catch (err) {
        logger.warn({ err }, "Poll error — retrying");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error("Timed out waiting for account to synchronize");
  }
}

export const synchronizationService = new SynchronizationService();
