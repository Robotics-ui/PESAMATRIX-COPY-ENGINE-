import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { subscriptionScheduler } from "./services/subscription.scheduler.js";
import { startAllWorkers, stopAllWorkers } from "./queues/index.js";
import { logMpesaConfigStatus } from "./services/mpesa.service.js";
import { db, usersTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Seed admin user (idempotent) ───────────────────────────────────────────────
async function seedAdmin(): Promise<void> {
  const ADMIN_EMAIL = "craigphilip761@gmail.com";
  const ADMIN_PASSWORD = "Pesa@2026!";

  try {
    const existing = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].role !== "admin") {
        await db
          .update(usersTable)
          .set({ role: "admin" })
          .where(eq(usersTable.email, ADMIN_EMAIL));
        logger.info({ email: ADMIN_EMAIL }, "[Seed] Promoted existing user to admin");
      } else {
        logger.info({ email: ADMIN_EMAIL }, "[Seed] Admin already exists");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(usersTable).values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      firstName: "Craig",
      lastName: "Philip",
      mustChangePassword: true,
    });

    logger.info({ email: ADMIN_EMAIL }, "[Seed] Admin user created");
  } catch (err) {
    logger.error({ err }, "[Seed] Failed to seed admin — continuing startup");
  }
}

// ── Start server ───────────────────────────────────────────────────────────────
seedAdmin().then(() => {
  const server = app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    logMpesaConfigStatus();

    startAllWorkers();
    logger.info("[Workers] BullMQ workers started");

    subscriptionScheduler.start();
    logger.info("[Scheduler] Subscription expiry scheduler started");
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
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
});
