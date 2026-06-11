import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection.js";
import { logger } from "../../lib/logger.js";
import type { NotificationJobData } from "../job-types.js";

const QUEUE_NAME = "NotificationQueue";

/**
 * Notification worker.
 *
 * Currently logs all events — extend this processor to send SMS via
 * Africa's Talking, push via FCM, or email via SendGrid when credentials
 * are available.  The queue and retry infrastructure is ready.
 */
async function processJob(job: Job<NotificationJobData>): Promise<unknown> {
  const { data } = job;
  const log = logger.child({
    queue: QUEUE_NAME,
    jobId: job.id,
    type: data.type,
    userId: data.userId,
  });

  log.info({ attempt: job.attemptsMade + 1 }, "[NotificationWorker] Processing notification");

  switch (data.type) {
    case "payment-confirmed": {
      log.info(
        {
          userId: data.userId,
          mpesaRef: data.mpesaRef,
          amount: data.amount,
          subscriptionId: data.subscriptionId,
        },
        "[NotificationWorker] Payment confirmed notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    case "payment-failed": {
      log.info(
        { userId: data.userId, paymentId: data.paymentId, reason: data.reason },
        "[NotificationWorker] Payment failed notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    case "subscription-activated": {
      log.info(
        { userId: data.userId, subscriptionId: data.subscriptionId, endDate: data.endDate },
        "[NotificationWorker] Subscription activated notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    case "subscription-expired": {
      log.info(
        { userId: data.userId, subscriptionId: data.subscriptionId },
        "[NotificationWorker] Subscription expired notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    case "deployment-complete": {
      log.info(
        { userId: data.userId, mt5AccountId: data.mt5AccountId, login: data.login },
        "[NotificationWorker] Deployment complete notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    case "deployment-failed": {
      log.warn(
        { userId: data.userId, mt5AccountId: data.mt5AccountId, login: data.login, error: data.error },
        "[NotificationWorker] Deployment failed notification — TODO: send SMS/push",
      );
      return { delivered: false, reason: "no-provider-configured" };
    }

    default: {
      const _exhaustive: never = data;
      throw new Error(`[NotificationWorker] Unknown type: ${(_exhaustive as NotificationJobData).type}`);
    }
  }
}

export function startNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 50,
      removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  );

  worker.on("completed", (job) => {
    logger.info({ queue: QUEUE_NAME, jobId: job.id, type: job.data.type }, "[NotificationWorker] Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { queue: QUEUE_NAME, jobId: job?.id, type: job?.data?.type, err, attemptsMade: job?.attemptsMade },
      "[NotificationWorker] Job failed",
    );
  });

  worker.on("error", (err) => {
    logger.error({ queue: QUEUE_NAME, err }, "[NotificationWorker] Worker error");
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 50 }, "[NotificationWorker] Started");
  return worker;
}
