import { and, eq, lt, isNotNull } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { SubscriptionQueue } from "../queues/index.js";
import { logger } from "../lib/logger.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export class SubscriptionScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * Start the periodic expiry-check job.
   *
   * Each tick scans for expired subscriptions and enqueues one
   * SubscriptionQueue `expire-subscription` job per subscription.
   * Workers process them concurrently with retry & dead-letter support —
   * no more sequential in-process looping over 2,000 accounts.
   *
   * @param intervalMs How often to scan (default 5 min).
   */
  start(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.intervalId) {
      logger.warn("[Scheduler] SubscriptionScheduler is already running");
      return;
    }

    logger.info({ intervalMs }, "[Scheduler] Starting SubscriptionScheduler");

    this.intervalId = setInterval(() => {
      void this.tick();
    }, intervalMs);

    void this.tick();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[Scheduler] SubscriptionScheduler stopped");
    }
  }

  /**
   * Run a single expiry-scan pass.  Exposed for manual admin triggers.
   */
  async runNow(): Promise<{ scanned: number; queued: number; alreadyQueued: number }> {
    return this.tick();
  }

  private async tick(): Promise<{ scanned: number; queued: number; alreadyQueued: number }> {
    if (this.running) {
      logger.debug("[Scheduler] Tick skipped — previous run still in progress");
      return { scanned: 0, queued: 0, alreadyQueued: 0 };
    }

    this.running = true;

    try {
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
        return { scanned: 0, queued: 0, alreadyQueued: 0 };
      }

      logger.info(
        { count: expiredSubscriptions.length },
        "[Scheduler] Found expired subscriptions — enqueueing jobs",
      );

      let queued = 0;
      let alreadyQueued = 0;

      await Promise.all(
        expiredSubscriptions.map(async (sub) => {
          try {
            const jobId = `expire-${sub.id}`;

            const existing = await SubscriptionQueue.getJob(jobId);
            if (existing) {
              alreadyQueued++;
              logger.debug(
                { subscriptionId: sub.id, jobId },
                "[Scheduler] Expiry job already in queue — skipping",
              );
              return;
            }

            await SubscriptionQueue.add(
              "expire-subscription",
              {
                type: "expire-subscription",
                subscriptionId: sub.id,
                userId: sub.userId,
              },
              { jobId },
            );

            queued++;
            logger.debug(
              { subscriptionId: sub.id, userId: sub.userId, endDate: sub.endDate, jobId },
              "[Scheduler] Enqueued expiry job",
            );
          } catch (err) {
            logger.error(
              { err, subscriptionId: sub.id },
              "[Scheduler] Failed to enqueue expiry job",
            );
          }
        }),
      );

      logger.info(
        { scanned: expiredSubscriptions.length, queued, alreadyQueued },
        "[Scheduler] Expiry scan complete",
      );

      return { scanned: expiredSubscriptions.length, queued, alreadyQueued };
    } catch (err) {
      logger.error({ err }, "[Scheduler] Tick error");
      return { scanned: 0, queued: 0, alreadyQueued: 0 };
    } finally {
      this.running = false;
    }
  }
}

export const subscriptionScheduler = new SubscriptionScheduler();
