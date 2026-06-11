import app from "./app.js";
import { logger } from "./lib/logger.js";
import { subscriptionScheduler } from "./services/subscription.scheduler.js";
import { startAllWorkers, stopAllWorkers } from "./queues/index.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  startAllWorkers();
  logger.info("[Workers] BullMQ workers started");

  subscriptionScheduler.start();
  logger.info("[Scheduler] Subscription expiry scheduler started");
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[Shutdown] Graceful shutdown initiated");

  server.close((err) => {
    if (err) logger.error({ err }, "[Shutdown] Error closing HTTP server");
    else logger.info("[Shutdown] HTTP server closed");
  });

  subscriptionScheduler.stop();
  logger.info("[Shutdown] Subscription scheduler stopped");

  await stopAllWorkers();
  logger.info("[Shutdown] All workers and Redis connections closed");

  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
