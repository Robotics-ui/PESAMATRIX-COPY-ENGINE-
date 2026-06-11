import type { Worker } from "bullmq";
import { startDeploymentWorker } from "./workers/deployment.worker.js";
import { startCopyFactoryWorker } from "./workers/copyfactory.worker.js";
import { startSubscriptionWorker } from "./workers/subscription.worker.js";
import { startPaymentWorker } from "./workers/payment.worker.js";
import { startNotificationWorker } from "./workers/notification.worker.js";
import { closeRedisConnection } from "./connection.js";
import { ALL_QUEUES } from "./queues.js";
import { logger } from "../lib/logger.js";

export {
  AccountDeploymentQueue,
  CopyFactoryQueue,
  SubscriptionQueue,
  PaymentQueue,
  NotificationQueue,
  ALL_QUEUES,
  getQueueStats,
  getFailedJobs,
} from "./queues.js";

const activeWorkers: Worker[] = [];

/**
 * Start all BullMQ workers.
 *
 * Workers run in the same Node process as the API server.  At ~2,000
 * subscribers the combined workload comfortably fits in a single process;
 * split into separate processes only if CPU/memory pressure demands it.
 */
export function startAllWorkers(): void {
  logger.info("[Workers] Starting all BullMQ workers");

  activeWorkers.push(
    startDeploymentWorker(),
    startCopyFactoryWorker(),
    startSubscriptionWorker(),
    startPaymentWorker(),
    startNotificationWorker(),
  );

  logger.info(
    { count: activeWorkers.length },
    "[Workers] All workers started",
  );
}

/**
 * Gracefully shut down all workers and close the Redis connection.
 * Call this on SIGTERM / SIGINT to drain in-flight jobs before exit.
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info("[Workers] Graceful shutdown initiated — draining in-flight jobs");

  await Promise.all(activeWorkers.map((w) => w.close()));
  activeWorkers.length = 0;

  await Promise.all(ALL_QUEUES.map((q) => q.close()));

  await closeRedisConnection();

  logger.info("[Workers] All workers stopped and Redis connection closed");
}
