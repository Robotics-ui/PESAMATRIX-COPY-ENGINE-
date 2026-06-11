import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection.js";
import { subscriberService } from "../../services/subscriber.service.js";
import { logger } from "../../lib/logger.js";
import type { CopyFactoryJobData } from "../job-types.js";

const QUEUE_NAME = "CopyFactoryQueue";

async function processJob(job: Job<CopyFactoryJobData>): Promise<unknown> {
  const { data } = job;
  const log = logger.child({ queue: QUEUE_NAME, jobId: job.id, type: data.type });

  log.info(
    { attempt: job.attemptsMade + 1, userId: data.userId },
    "[CopyFactoryWorker] Processing job",
  );

  switch (data.type) {
    case "register-subscriber": {
      const { userId, metaApiAccountId, subscriptionId, multiplier } = data;

      log.info(
        { userId, metaApiAccountId, subscriptionId, multiplier },
        "[CopyFactoryWorker] Registering CopyFactory subscriber",
      );

      const result = await subscriberService.registerSubscriber({
        userId,
        metaApiAccountId,
        subscriptionId,
        multiplier: multiplier ?? 1.0,
      });

      log.info(
        {
          userId,
          metaApiAccountId,
          strategyId: result.strategyId,
          relationshipId: result.relationshipId,
          multiplier: result.multiplier,
        },
        "[CopyFactoryWorker] Subscriber registered — copy trading ENABLED",
      );

      return result;
    }

    case "remove-subscriber": {
      const { userId, metaApiAccountId, reason } = data;

      log.info(
        { userId, metaApiAccountId, reason },
        "[CopyFactoryWorker] Removing CopyFactory subscriber",
      );

      await subscriberService.removeSubscriber({
        userId,
        metaApiAccountId,
        reason: reason ?? "manual",
      });

      log.info(
        { userId, metaApiAccountId, reason },
        "[CopyFactoryWorker] Subscriber removed — copy trading DISABLED",
      );

      return { removed: true };
    }

    default: {
      const _exhaustive: never = data;
      throw new Error(`[CopyFactoryWorker] Unknown job type: ${(_exhaustive as CopyFactoryJobData).type}`);
    }
  }
}

export function startCopyFactoryWorker(): Worker<CopyFactoryJobData> {
  /**
   * Concurrency 20: at 2,000 subscribers, running 20 concurrent CopyFactory
   * API calls completes a full bulk cycle in ~100 batches. Each PUT to the
   * CopyFactory API typically takes 200-500ms, so 100 batches × ~350ms ≈
   * ~35 seconds for 2,000 accounts — well within any reasonable SLA.
   */
  const worker = new Worker<CopyFactoryJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 20,
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info(
      { queue: QUEUE_NAME, jobId: job.id, type: job.data.type, userId: job.data.userId, result },
      "[CopyFactoryWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAME,
        jobId: job?.id,
        type: job?.data?.type,
        userId: job?.data?.userId,
        err,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts?.attempts,
      },
      "[CopyFactoryWorker] Job failed",
    );
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ queue: QUEUE_NAME, jobId }, "[CopyFactoryWorker] Job stalled");
  });

  worker.on("error", (err) => {
    logger.error({ queue: QUEUE_NAME, err }, "[CopyFactoryWorker] Worker error");
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 20 }, "[CopyFactoryWorker] Started");
  return worker;
}
