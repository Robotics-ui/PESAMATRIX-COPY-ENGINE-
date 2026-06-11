import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  metaApiAccountsTable,
  copyFactoryRelationshipsTable,
  adminSettingsTable,
  subscriptionsTable,
} from "@workspace/db";
import { copyFactoryService } from "./copyfactory.service.js";
import { logger } from "../lib/logger.js";

const MASTER_SETTINGS_KEY = "default";

export interface SubscriberRegistrationResult {
  metaApiAccountId: string;
  strategyId: string;
  multiplier: number;
  relationshipId: string;
}

export interface SubscriberStatus {
  metaApiAccountId: string;
  isRegistered: boolean;
  subscriptions: Array<{ strategyId: string; multiplier: number }>;
}

export interface ActiveSubscriberRecord {
  relationshipId: string;
  userId: string;
  metaApiAccountId: string;
  copyFactorySubscriberId: string | null;
  strategyId: string;
  multiplier: string;
}

export class SubscriberService {
  /**
   * Register a MetaApi account as a CopyFactory subscriber under the current
   * master strategy.  Idempotent — safe to call multiple times.
   *
   * Designed to handle ~2,000 concurrent subscriber accounts: each call is an
   * independent PUT to CopyFactory so there is no shared lock or fan-out.
   */
  async registerSubscriber(params: {
    userId: string;
    metaApiAccountId: string;
    subscriptionId?: string;
    multiplier?: number;
  }): Promise<SubscriberRegistrationResult> {
    const { userId, metaApiAccountId, subscriptionId, multiplier = 1.0 } = params;

    const [settings] = await db
      .select({
        copyFactoryStrategyId: adminSettingsTable.copyFactoryStrategyId,
        masterMetaApiAccountId: adminSettingsTable.masterMetaApiAccountId,
      })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY))
      .limit(1);

    if (!settings?.copyFactoryStrategyId) {
      throw new Error("Master CopyFactory strategy is not configured");
    }

    const strategyId = settings.copyFactoryStrategyId;

    logger.info(
      { userId, metaApiAccountId, strategyId, multiplier },
      "Registering CopyFactory subscriber",
    );

    await copyFactoryService.addSubscriber(metaApiAccountId, strategyId, multiplier);

    const [subscriberMetaApiDbRecord] = await db
      .select({ id: metaApiAccountsTable.id })
      .from(metaApiAccountsTable)
      .where(eq(metaApiAccountsTable.metaApiId, metaApiAccountId))
      .limit(1);

    if (!subscriberMetaApiDbRecord) {
      throw new Error(`MetaApi DB record not found for account ${metaApiAccountId}`);
    }

    const masterMetaApiDbRecord = settings.masterMetaApiAccountId
      ? (
          await db
            .select({ id: metaApiAccountsTable.id })
            .from(metaApiAccountsTable)
            .where(eq(metaApiAccountsTable.metaApiId, settings.masterMetaApiAccountId))
            .limit(1)
        )[0] ?? null
      : null;

    const masterDbId = masterMetaApiDbRecord?.id ?? subscriberMetaApiDbRecord.id;

    const existing = await db
      .select({ id: copyFactoryRelationshipsTable.id })
      .from(copyFactoryRelationshipsTable)
      .where(
        and(
          eq(copyFactoryRelationshipsTable.subscriberUserId, userId),
          eq(copyFactoryRelationshipsTable.copyFactoryStrategyId, strategyId),
        ),
      )
      .limit(1);

    let relationshipId: string;

    if (existing.length > 0) {
      await db
        .update(copyFactoryRelationshipsTable)
        .set({
          status: "active",
          isActive: true,
          multiplier: String(multiplier),
          copyFactorySubscriberId: metaApiAccountId,
          ...(subscriptionId ? { subscriptionId } : {}),
          activatedAt: new Date(),
          deactivatedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(copyFactoryRelationshipsTable.id, existing[0].id));

      relationshipId = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(copyFactoryRelationshipsTable)
        .values({
          subscriberUserId: userId,
          subscriberMetaApiAccountId: subscriberMetaApiDbRecord.id,
          masterMetaApiAccountId: masterDbId,
          copyFactoryStrategyId: strategyId,
          copyFactorySubscriberId: metaApiAccountId,
          ...(subscriptionId ? { subscriptionId } : {}),
          status: "active",
          multiplier: String(multiplier),
          isActive: true,
          activatedAt: new Date(),
        })
        .returning({ id: copyFactoryRelationshipsTable.id });

      relationshipId = inserted.id;
    }

    logger.info({ userId, metaApiAccountId, strategyId, relationshipId }, "Subscriber registered");

    return { metaApiAccountId, strategyId, multiplier, relationshipId };
  }

  /**
   * Remove a MetaApi account from CopyFactory copying.
   * Updates the DB relationship to "removed" and sets isActive = false.
   */
  async removeSubscriber(params: {
    userId: string;
    metaApiAccountId: string;
    reason?: "expired" | "cancelled" | "manual";
  }): Promise<void> {
    const { userId, metaApiAccountId, reason = "manual" } = params;

    const [settings] = await db
      .select({ copyFactoryStrategyId: adminSettingsTable.copyFactoryStrategyId })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY))
      .limit(1);

    if (!settings?.copyFactoryStrategyId) {
      throw new Error("Master CopyFactory strategy is not configured");
    }

    const strategyId = settings.copyFactoryStrategyId;

    logger.info({ userId, metaApiAccountId, strategyId, reason }, "Removing CopyFactory subscriber");

    try {
      await copyFactoryService.removeSubscriber(metaApiAccountId, strategyId);
    } catch (err) {
      logger.warn({ err, metaApiAccountId }, "CopyFactory removeSubscriber API error — continuing DB update");
    }

    const newStatus =
      reason === "expired" ? "removed" : reason === "cancelled" ? "removed" : "removed";

    await db
      .update(copyFactoryRelationshipsTable)
      .set({
        status: newStatus,
        isActive: false,
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(copyFactoryRelationshipsTable.subscriberUserId, userId),
          eq(copyFactoryRelationshipsTable.copyFactoryStrategyId, strategyId),
          eq(copyFactoryRelationshipsTable.isActive, true),
        ),
      );

    logger.info({ userId, metaApiAccountId, strategyId }, "Subscriber removed");
  }

  /**
   * Query CopyFactory for the live subscription state of a given MetaApi account.
   */
  async getSubscriberStatus(metaApiAccountId: string): Promise<SubscriberStatus> {
    try {
      const cf = await copyFactoryService.getSubscriber(metaApiAccountId);
      return {
        metaApiAccountId,
        isRegistered: (cf.subscriptions?.length ?? 0) > 0,
        subscriptions: cf.subscriptions ?? [],
      };
    } catch {
      return { metaApiAccountId, isRegistered: false, subscriptions: [] };
    }
  }

  /**
   * Return all currently active subscriber relationships from the DB.
   * Used by the scheduler to detect stale/expired relationships.
   */
  async listActiveSubscribers(): Promise<ActiveSubscriberRecord[]> {
    const rows = await db
      .select({
        relationshipId: copyFactoryRelationshipsTable.id,
        userId: copyFactoryRelationshipsTable.subscriberUserId,
        metaApiDbId: copyFactoryRelationshipsTable.subscriberMetaApiAccountId,
        copyFactorySubscriberId: copyFactoryRelationshipsTable.copyFactorySubscriberId,
        strategyId: copyFactoryRelationshipsTable.copyFactoryStrategyId,
        multiplier: copyFactoryRelationshipsTable.multiplier,
        metaApiId: metaApiAccountsTable.metaApiId,
      })
      .from(copyFactoryRelationshipsTable)
      .innerJoin(
        metaApiAccountsTable,
        eq(metaApiAccountsTable.id, copyFactoryRelationshipsTable.subscriberMetaApiAccountId),
      )
      .where(eq(copyFactoryRelationshipsTable.isActive, true));

    type RowShape = {
      relationshipId: string;
      userId: string;
      metaApiDbId: string;
      copyFactorySubscriberId: string | null;
      strategyId: string;
      multiplier: string;
      metaApiId: string;
    };

    return (rows as RowShape[]).map((r) => ({
      relationshipId: r.relationshipId,
      userId: r.userId,
      metaApiAccountId: r.metaApiId,
      copyFactorySubscriberId: r.copyFactorySubscriberId,
      strategyId: r.strategyId,
      multiplier: r.multiplier,
    }));
  }

  /**
   * Bulk-remove a list of subscriber MetaApi account IDs from CopyFactory.
   * Processes sequentially to avoid overwhelming the API.
   * Suitable for batch expiry jobs over ~2,000 accounts.
   */
  async bulkRemoveSubscribers(
    entries: Array<{ userId: string; metaApiAccountId: string }>,
    reason: "expired" | "cancelled" | "manual" = "expired",
  ): Promise<{ removed: number; failed: number }> {
    let removed = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.removeSubscriber({ ...entry, reason });
        removed++;
      } catch (err) {
        failed++;
        logger.error({ err, ...entry }, "Bulk subscriber removal failed for account");
      }
    }

    return { removed, failed };
  }
}

export const subscriberService = new SubscriberService();
