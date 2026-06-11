import { relationshipService } from "./relationship.service.js";
import { logger } from "../lib/logger.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export class SubscriptionScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * Start the periodic expiry-check job.
   *
   * @param intervalMs How often to check for expired subscriptions (default 5 min).
   */
  start(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.intervalId) {
      logger.warn("SubscriptionScheduler is already running");
      return;
    }

    logger.info({ intervalMs }, "Starting SubscriptionScheduler");

    this.intervalId = setInterval(() => {
      void this.tick();
    }, intervalMs);

    void this.tick();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("SubscriptionScheduler stopped");
    }
  }

  /**
   * Run a single expiry-processing pass.  Exposed for manual admin triggers.
   */
  async runNow(): Promise<{ processed: number; detached: number; failed: number }> {
    return this.tick();
  }

  private async tick(): Promise<{ processed: number; detached: number; failed: number }> {
    if (this.running) {
      logger.debug("SubscriptionScheduler tick skipped — previous run still in progress");
      return { processed: 0, detached: 0, failed: 0 };
    }

    this.running = true;
    try {
      const result = await relationshipService.processExpiredSubscriptions();
      if (result.processed > 0) {
        logger.info(result, "SubscriptionScheduler tick complete");
      }
      return result;
    } catch (err) {
      logger.error({ err }, "SubscriptionScheduler tick error");
      return { processed: 0, detached: 0, failed: 1 };
    } finally {
      this.running = false;
    }
  }
}

export const subscriptionScheduler = new SubscriptionScheduler();
