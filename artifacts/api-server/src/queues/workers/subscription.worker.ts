import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { getRedisConnection } from "../connection.js";
import { relationshipService } from "../../services/relationship.service.js";
import { logger } from "../../lib/logger.js";
import type { SubscriptionJobData } from "../job-types.js";

const QUEUE_NAME = "SubscriptionQueue";

async function processJob(job: Job<SubscriptionJobData>): Promise<unknown> {
  const { data } = job;
  const log = logger.child({
    queue: QUEUE_NAME,
    jobId: job.id,
    type: data.type,
    subscriptionId: data.subscriptionId,
    userId: data.userId,
  });

  log.info({ attempt: job.attemptsMade + 1 }, "[SubscriptionWorker] Processing job");

  switch (data.type) {
    case "expire-subscription": {
      const { subscriptionId, userId } = data;

      log.info("[SubscriptionWorker] Processing subscription expiry");

      const [sub] = await db
        .select({ id: subscriptionsTable.id, status: subscriptionsTable.status })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!sub) {
        log.warn("[SubscriptionWorker] Subscription not found — skipping");
        return { skipped: true, reason: "not found" };
      }

      if (sub.status === "expired") {
        log.info("[SubscriptionWorker] Already expired — idempotent skip");
        return { skipped: true, reason: "already expired" };
      }

      log.info("[SubscriptionWorker] Marking subscription EXPIRED in DB");
      await db
        .update(subscriptionsTable)
        .set({ status: "expired", isActive: false, updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscriptionId));

      log.info("[SubscriptionWorker] Detaching CopyFactory subscriber via RelationshipService");
      const detachResult = await relationshipService.onSubscriptionExpired({
        subscriptionId,
        userId,
        reason: "expired",
      });

      log.info(
        {
          subscriptionId,
          userId,
          detached: detachResult.detached,
          metaApiAccountId: detachResult.metaApiAccountId,
        },
        "[SubscriptionWorker] Subscription expiry complete",
      );

      return { expired: true, detached: detachResult.detached };
    }

    case "cancel-subscription": {
      const { subscriptionId, userId, reason } = data;

      log.info({ reason }, "[SubscriptionWorker] Processing subscription cancellation");

      const [sub] = await db
        .select({ id: subscriptionsTable.id, status: subscriptionsTable.status })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!sub) {
        log.warn("[SubscriptionWorker] Subscription not found — skipping");
        return { skipped: true, reason: "not found" };
      }

      if (sub.status === "cancelled" || sub.status === "expired") {
        log.info({ currentStatus: sub.status }, "[SubscriptionWorker] Already terminal — idempotent skip");
        return { skipped: true, reason: `already ${sub.status}` };
      }

      log.info("[SubscriptionWorker] Marking subscription CANCELLED in DB");
      await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", isActive: false, updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscriptionId));

      log.info("[SubscriptionWorker] Detaching CopyFactory subscriber via RelationshipService");
      const detachResult = await relationshipService.onSubscriptionExpired({
        subscriptionId,
        userId,
        reason: "cancelled",
      });

      log.info(
        { subscriptionId, userId, detached: detachResult.detached },
        "[SubscriptionWorker] Cancellation complete",
      );

      return { cancelled: true, detached: detachResult.detached };
    }

    case "activate-subscription": {
      const { subscriptionId, userId } = data;

      log.info("[SubscriptionWorker] Processing subscription activation via queue");

      const [sub] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!sub) {
        log.warn("[SubscriptionWorker] Subscription not found");
        return { skipped: true, reason: "not found" };
      }

      if (sub.status === "active") {
        log.info("[SubscriptionWorker] Already active — enqueuing CopyFactory attach only");
        const cfResult = await relationshipService.onSubscriptionActivated({ subscriptionId, userId }).catch((e) => {
          log.error({ e }, "[SubscriptionWorker] CopyFactory attach failed on already-active sub");
          return null;
        });
        return { skipped: true, reason: "already active", copyfactoryAttached: cfResult !== null };
      }

      const now = new Date();
      const isRenewal = sub.status === "active" && sub.endDate !== null && sub.endDate > now;
      const startDate = isRenewal ? sub.endDate! : now;
      const endDate = new Date(startDate.getTime() + sub.numberOfDays * 24 * 60 * 60 * 1000);

      await db
        .update(subscriptionsTable)
        .set({ status: "active", isActive: true, startDate, endDate, updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscriptionId));

      log.info({ startDate, endDate, isRenewal }, "[SubscriptionWorker] Subscription ACTIVATED");

      const cfResult = await relationshipService.onSubscriptionActivated({ subscriptionId, userId }).catch((e) => {
        log.error({ e }, "[SubscriptionWorker] CopyFactory attach failed — will retry");
        throw e;
      });

      log.info(
        { subscriptionId, userId, copyfactoryAttached: cfResult !== null },
        "[SubscriptionWorker] Activation complete",
      );

      return { activated: true, endDate, copyfactoryAttached: cfResult !== null };
    }

    default: {
      const _exhaustive: never = data;
      throw new Error(`[SubscriptionWorker] Unknown job type: ${(_exhaustive as SubscriptionJobData).type}`);
    }
  }
}

export function startSubscriptionWorker(): Worker<SubscriptionJobData> {
  const worker = new Worker<SubscriptionJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 10,
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info(
      { queue: QUEUE_NAME, jobId: job.id, type: job.data.type, subscriptionId: job.data.subscriptionId, result },
      "[SubscriptionWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAME,
        jobId: job?.id,
        type: job?.data?.type,
        subscriptionId: job?.data?.subscriptionId,
        err,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts?.attempts,
      },
      "[SubscriptionWorker] Job exhausted all retries — in dead-letter",
    );
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ queue: QUEUE_NAME, jobId }, "[SubscriptionWorker] Job stalled — will be re-queued");
  });

  worker.on("error", (err) => {
    logger.error({ queue: QUEUE_NAME, err }, "[SubscriptionWorker] Worker error");
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 10 }, "[SubscriptionWorker] Started");
  return worker;
}
