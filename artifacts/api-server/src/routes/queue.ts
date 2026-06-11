import { Router, type IRouter } from "express";
import { z } from "zod";
import { ALL_QUEUES, getQueueStats, getFailedJobs } from "../queues/index.js";
import { validateBody } from "../middlewares/validate.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const RetryJobSchema = z.object({
  queueName: z.string().min(1),
  jobId: z.string().min(1),
});

const FlushSchema = z.object({
  queueName: z.string().min(1),
  status: z.enum(["failed", "completed", "delayed", "wait", "active"]).default("failed"),
});

// ── GET /admin/queue/stats ─────────────────────────────────────────────────────
/**
 * Returns per-queue counts: active, waiting, delayed, failed, completed, paused.
 * Suitable for a monitoring dashboard.
 */
router.get("/queue/stats", async (_req, res) => {
  try {
    const stats = await getQueueStats();

    const totalFailed = stats.reduce((sum, q) => sum + q.failed, 0);
    const totalActive = stats.reduce((sum, q) => sum + q.active, 0);
    const totalWaiting = stats.reduce((sum, q) => sum + q.waiting, 0);

    res.json({
      summary: { totalFailed, totalActive, totalWaiting },
      queues: stats,
    });
  } catch (err) {
    logger.error({ err }, "[QueueRoute] Error fetching queue stats");
    res.status(503).json({ error: "Queue monitoring unavailable" });
  }
});

// ── GET /admin/queue/failed ────────────────────────────────────────────────────
/**
 * Returns failed (dead-letter) jobs across all queues, or a specific queue.
 * Up to 50 most recent failed jobs per queue.
 */
router.get("/queue/failed", async (req, res) => {
  const queueName = typeof req.query.queue === "string" ? req.query.queue : undefined;

  try {
    const failed = await getFailedJobs(queueName);
    const totalCount = failed.reduce((sum, q) => sum + q.jobs.length, 0);

    res.json({ totalCount, queues: failed });
  } catch (err) {
    logger.error({ err }, "[QueueRoute] Error fetching failed jobs");
    res.status(503).json({ error: "Queue monitoring unavailable" });
  }
});

// ── GET /admin/queue/health ────────────────────────────────────────────────────
/**
 * Lightweight health check for the queue system.
 * Returns "healthy" if Redis is reachable and all queues are responsive.
 */
router.get("/queue/health", async (_req, res) => {
  try {
    const stats = await getQueueStats();
    const failedCounts = stats.map((q) => ({ queue: q.name, failed: q.failed }));
    const hasCriticalBacklog = failedCounts.some((q) => q.failed > 100);

    res.json({
      status: hasCriticalBacklog ? "degraded" : "healthy",
      redis: "connected",
      queues: failedCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "[QueueRoute] Health check failed");
    res.status(503).json({
      status: "unhealthy",
      redis: "disconnected",
      error: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// ── POST /admin/queue/retry ────────────────────────────────────────────────────
/**
 * Retry a specific failed job by ID.
 * Resets the attempt counter and moves it back to the waiting queue.
 */
router.post("/queue/retry", validateBody(RetryJobSchema), async (req, res) => {
  const { queueName, jobId } = req.body as z.infer<typeof RetryJobSchema>;

  const queue = ALL_QUEUES.find((q) => q.name === queueName);
  if (!queue) {
    res.status(404).json({ error: `Queue "${queueName}" not found` });
    return;
  }

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: `Job "${jobId}" not found in ${queueName}` });
      return;
    }

    await job.retry("failed");

    logger.info({ queueName, jobId }, "[QueueRoute] Job queued for retry");
    res.json({ message: "Job queued for retry", jobId, queueName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed";
    logger.error({ err, queueName, jobId }, "[QueueRoute] Job retry error");
    res.status(500).json({ error: message });
  }
});

// ── POST /admin/queue/flush ────────────────────────────────────────────────────
/**
 * Remove all jobs in a given status from a specific queue.
 * Use with caution — permanently discards dead-letter jobs.
 */
router.post("/queue/flush", validateBody(FlushSchema), async (req, res) => {
  const { queueName, status } = req.body as z.infer<typeof FlushSchema>;

  const queue = ALL_QUEUES.find((q) => q.name === queueName);
  if (!queue) {
    res.status(404).json({ error: `Queue "${queueName}" not found` });
    return;
  }

  try {
    await queue.clean(0, 1_000, status);

    logger.warn({ queueName, status }, "[QueueRoute] Queue flushed");
    res.json({ message: `Flushed ${status} jobs from ${queueName}`, queueName, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flush failed";
    logger.error({ err, queueName, status }, "[QueueRoute] Queue flush error");
    res.status(500).json({ error: message });
  }
});

// ── GET /admin/queue/jobs/:queueName ──────────────────────────────────────────
/**
 * List active and waiting jobs for a specific queue.
 * Useful for debugging job processing state.
 */
router.get("/queue/jobs/:queueName", async (req, res) => {
  const { queueName } = req.params;

  const queue = ALL_QUEUES.find((q) => q.name === queueName);
  if (!queue) {
    res.status(404).json({ error: `Queue "${queueName}" not found` });
    return;
  }

  try {
    const [active, waiting, delayed] = await Promise.all([
      queue.getActive(0, 19),
      queue.getWaiting(0, 19),
      queue.getDelayed(0, 19),
    ]);

    const mapJob = (j: (typeof active)[0]) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
    });

    res.json({
      queue: queueName,
      active: active.map(mapJob),
      waiting: waiting.map(mapJob),
      delayed: delayed.map(mapJob),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    res.status(503).json({ error: message });
  }
});

export default router;
