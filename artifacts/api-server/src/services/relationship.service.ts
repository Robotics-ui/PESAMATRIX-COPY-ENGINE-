import { eq, and, lt, isNotNull } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  copyFactoryRelationshipsTable,
  metaApiAccountsTable,
  mt5AccountsTable,
} from "@workspace/db";
import { subscriberService } from "./subscriber.service.js";
import { logger } from "../lib/logger.js";

export interface AttachResult {
  relationshipId: string;
  metaApiAccountId: string;
  strategyId: string;
}

export interface DetachResult {
  detached: boolean;
  metaApiAccountId: string | null;
}

export interface ExpiredProcessResult {
  processed: number;
  detached: number;
  failed: number;
}

export class RelationshipService {
  /**
   * Called when a subscription becomes ACTIVE.
   *
   * Finds the user's deployed MetaApi account and registers it as a CopyFactory
   * subscriber under the master strategy.  If the user has no deployed account
   * yet the call is a no-op (the subscriber will be attached once the account
   * is deployed via the MT5 deploy flow).
   */
  async onSubscriptionActivated(params: {
    subscriptionId: string;
    userId: string;
    multiplier?: number;
  }): Promise<AttachResult | null> {
    const { subscriptionId, userId, multiplier = 1.0 } = params;

    logger.info({ subscriptionId, userId }, "Subscription activated — attaching CopyFactory subscriber");

    const metaApiAccount = await this.findDeployedSubscriberAccount(userId);

    if (!metaApiAccount) {
      logger.info(
        { userId, subscriptionId },
        "No deployed MetaApi account found; skipping CopyFactory attach (will attach at deploy time)",
      );
      return null;
    }

    const result = await subscriberService.registerSubscriber({
      userId,
      metaApiAccountId: metaApiAccount.metaApiId,
      subscriptionId,
      multiplier,
    });

    await db
      .update(subscriptionsTable)
      .set({
        copyFactorySubscriberId: metaApiAccount.metaApiId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subscriptionId));

    logger.info(
      { subscriptionId, userId, relationshipId: result.relationshipId },
      "CopyFactory subscriber attached on subscription activation",
    );

    return {
      relationshipId: result.relationshipId,
      metaApiAccountId: metaApiAccount.metaApiId,
      strategyId: result.strategyId,
    };
  }

  /**
   * Called when a subscription EXPIRES or is CANCELLED.
   *
   * Detaches the subscriber from the CopyFactory master strategy and marks the
   * DB relationship as removed.
   */
  async onSubscriptionExpired(params: {
    subscriptionId: string;
    userId: string;
    reason?: "expired" | "cancelled";
  }): Promise<DetachResult> {
    const { subscriptionId, userId, reason = "expired" } = params;

    logger.info({ subscriptionId, userId, reason }, "Subscription expired — detaching CopyFactory subscriber");

    const metaApiAccount = await this.findDeployedSubscriberAccount(userId);

    if (!metaApiAccount) {
      logger.info({ userId, subscriptionId }, "No deployed account found; nothing to detach");
      return { detached: false, metaApiAccountId: null };
    }

    await subscriberService.removeSubscriber({
      userId,
      metaApiAccountId: metaApiAccount.metaApiId,
      reason,
    });

    await db
      .update(subscriptionsTable)
      .set({ updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subscriptionId));

    logger.info(
      { subscriptionId, userId, metaApiAccountId: metaApiAccount.metaApiId },
      "CopyFactory subscriber detached on subscription expiry",
    );

    return { detached: true, metaApiAccountId: metaApiAccount.metaApiId };
  }

  /**
   * Scan for all subscriptions whose endDate has passed and are still marked
   * active, then detach their CopyFactory relationships.
   *
   * Designed to run as a periodic background job.  Processes one entry at a
   * time to stay within CopyFactory API rate limits at ~2,000 accounts.
   */
  async processExpiredSubscriptions(): Promise<ExpiredProcessResult> {
    const now = new Date();

    const expiredSubscriptions = await db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        endDate: subscriptionsTable.endDate,
      })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.isActive, true),
          lt(subscriptionsTable.endDate, now),
          isNotNull(subscriptionsTable.endDate),
        ),
      );

    if (expiredSubscriptions.length === 0) {
      return { processed: 0, detached: 0, failed: 0 };
    }

    logger.info({ count: expiredSubscriptions.length }, "Processing expired subscriptions");

    let detached = 0;
    let failed = 0;

    for (const sub of expiredSubscriptions) {
      try {
        await db
          .update(subscriptionsTable)
          .set({ status: "expired", isActive: false, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));

        const result = await this.onSubscriptionExpired({
          subscriptionId: sub.id,
          userId: sub.userId,
          reason: "expired",
        });

        if (result.detached) detached++;
      } catch (err) {
        failed++;
        logger.error({ err, subscriptionId: sub.id, userId: sub.userId }, "Failed to process expired subscription");
      }
    }

    logger.info(
      { processed: expiredSubscriptions.length, detached, failed },
      "Expired subscription processing complete",
    );

    return { processed: expiredSubscriptions.length, detached, failed };
  }

  /**
   * Reattach a subscriber whose copying was paused (e.g. after a plan renewal).
   */
  async reattachSubscriber(params: {
    subscriptionId: string;
    userId: string;
    multiplier?: number;
  }): Promise<AttachResult | null> {
    return this.onSubscriptionActivated(params);
  }

  /**
   * Retrieve the current relationship state for a user.
   */
  async getRelationshipForUser(userId: string) {
    const rows = await db
      .select()
      .from(copyFactoryRelationshipsTable)
      .where(eq(copyFactoryRelationshipsTable.subscriberUserId, userId))
      .orderBy(copyFactoryRelationshipsTable.createdAt);

    return rows;
  }

  /**
   * Find the most recently deployed (non-master) MetaApi account for a user.
   */
  private async findDeployedSubscriberAccount(
    userId: string,
  ): Promise<{ metaApiId: string } | null> {
    const [record] = await db
      .select({ metaApiId: metaApiAccountsTable.metaApiId })
      .from(metaApiAccountsTable)
      .innerJoin(
        mt5AccountsTable,
        eq(mt5AccountsTable.id, metaApiAccountsTable.mt5AccountId),
      )
      .where(
        and(
          eq(metaApiAccountsTable.userId, userId),
          eq(metaApiAccountsTable.isMaster, false),
          eq(metaApiAccountsTable.state, "deployed"),
          eq(mt5AccountsTable.deploymentStatus, "deployed"),
        ),
      )
      .orderBy(metaApiAccountsTable.createdAt)
      .limit(1);

    return record ?? null;
  }
}

export const relationshipService = new RelationshipService();
