import { eq } from "drizzle-orm";
import { db, adminSettingsTable } from "@workspace/db";
import { copyFactoryService, type CopyFactoryStrategy } from "./copyfactory.service.js";
import { logger } from "../lib/logger.js";

const MASTER_SETTINGS_KEY = "default";

export interface StrategyInfo {
  strategyId: string;
  name: string;
  description?: string;
  positionLifecycle: string;
  connectionId: string;
  status: string;
}

export interface EnsureStrategyParams {
  strategyId: string;
  metaApiAccountId: string;
  name: string;
  description?: string;
}

export class StrategyService {
  /**
   * Retrieve the current master strategy ID from admin settings.
   * Returns null if no master has been configured yet.
   */
  async getMasterStrategyId(): Promise<string | null> {
    const [settings] = await db
      .select({ copyFactoryStrategyId: adminSettingsTable.copyFactoryStrategyId })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY))
      .limit(1);

    return settings?.copyFactoryStrategyId ?? null;
  }

  /**
   * Retrieve master strategy details from both admin settings and the
   * CopyFactory API.  Throws if no master strategy is configured.
   */
  async getMasterStrategy(): Promise<StrategyInfo> {
    const strategyId = await this.getMasterStrategyId();
    if (!strategyId) {
      throw new Error("Master CopyFactory strategy is not configured");
    }

    const cf = await copyFactoryService.getStrategy(strategyId);
    return this.mapStrategy(cf);
  }

  /**
   * Ensure a strategy exists on CopyFactory with the given parameters.
   * If the strategy already exists it is returned as-is (idempotent PUT).
   */
  async ensureStrategy(params: EnsureStrategyParams): Promise<StrategyInfo> {
    const { strategyId, metaApiAccountId, name, description } = params;

    logger.info({ strategyId, metaApiAccountId }, "Ensuring CopyFactory master strategy");

    const cf = await copyFactoryService.createStrategy(
      strategyId,
      metaApiAccountId,
      name,
      description,
    );

    logger.info({ strategyId }, "Master strategy ensured on CopyFactory");
    return this.mapStrategy(cf);
  }

  /**
   * List all strategies visible under the current CopyFactory account.
   */
  async listStrategies(): Promise<StrategyInfo[]> {
    const strategies = await copyFactoryService.listStrategies();
    return strategies.map((s) => this.mapStrategy(s));
  }

  /**
   * Fetch the master strategy details from the CopyFactory API by the
   * strategy ID stored in admin settings.  Returns null if nothing is
   * configured or if the remote call fails gracefully.
   */
  async getMasterStrategyInfo(): Promise<StrategyInfo | null> {
    const strategyId = await this.getMasterStrategyId();
    if (!strategyId) return null;

    try {
      const cf = await copyFactoryService.getStrategy(strategyId);
      return this.mapStrategy(cf);
    } catch (err) {
      logger.warn({ err, strategyId }, "Failed to fetch master strategy from CopyFactory");
      return null;
    }
  }

  private mapStrategy(cf: CopyFactoryStrategy): StrategyInfo {
    return {
      strategyId: cf._id,
      name: cf.name,
      description: cf.description,
      positionLifecycle: cf.positionLifecycle,
      connectionId: cf.connectionId,
      status: cf.status,
    };
  }
}

export const strategyService = new StrategyService();
