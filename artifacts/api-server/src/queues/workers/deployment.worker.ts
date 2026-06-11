import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection.js";
import { NotificationQueue } from "../queues.js";
import { deploymentService } from "../../services/deployment.service.js";
import { logger } from "../../lib/logger.js";
import type { AccountDeploymentJobData } from "../job-types.js";

const QUEUE_NAME = "AccountDeploymentQueue";

async function processJob(job: Job<AccountDeploymentJobData>): Promise<unknown> {
  const { data } = job;
  const log = logger.child({ queue: QUEUE_NAME, jobId: job.id, type: data.type });

  log.info({ attempt: job.attemptsMade + 1 }, "[DeploymentWorker] Processing job");

  switch (data.type) {
    case "deploy-subscriber": {
      const { mt5AccountDbId, userId, login, password, server, broker, region, multiplier } = data;

      log.info({ userId, login, server }, "[DeploymentWorker] Deploying subscriber MT5 account");

      try {
        const result = await deploymentService.deploySubscriberAccount({
          mt5AccountDbId,
          userId,
          login,
          password,
          server,
          broker,
          region,
          multiplier,
        });

        log.info(
          {
            userId,
            login,
            metaApiAccountId: result.metaApiAccountId,
            strategyId: result.copyFactoryStrategyId,
            relationshipId: result.copyFactoryRelationshipId,
          },
          "[DeploymentWorker] Subscriber account deployed successfully",
        );

        await NotificationQueue.add("deployment-complete", {
          type: "deployment-complete",
          userId,
          mt5AccountId: mt5AccountDbId,
          login,
        });

        return result;
      } catch (err) {
        log.error({ err, userId, login }, "[DeploymentWorker] Subscriber deployment failed");

        await NotificationQueue.add("deployment-failed", {
          type: "deployment-failed",
          userId,
          mt5AccountId: mt5AccountDbId,
          login,
          error: err instanceof Error ? err.message : "Unknown error",
        }).catch(() => {});

        throw err;
      }
    }

    case "deploy-master": {
      const { mt5AccountDbId, userId, login, password, server, broker, region } = data;

      log.info({ userId, login, server }, "[DeploymentWorker] Deploying master MT5 account");

      try {
        const result = await deploymentService.deployMasterAccount({
          mt5AccountDbId,
          login,
          password,
          server,
          broker,
          region,
        });

        log.info(
          {
            userId,
            login,
            metaApiAccountId: result.metaApiAccountId,
            strategyId: result.copyFactoryStrategyId,
          },
          "[DeploymentWorker] Master account deployed successfully",
        );

        await NotificationQueue.add("deployment-complete", {
          type: "deployment-complete",
          userId,
          mt5AccountId: mt5AccountDbId,
          login,
        });

        return result;
      } catch (err) {
        log.error({ err, userId, login }, "[DeploymentWorker] Master deployment failed");

        await NotificationQueue.add("deployment-failed", {
          type: "deployment-failed",
          userId,
          mt5AccountId: mt5AccountDbId,
          login,
          error: err instanceof Error ? err.message : "Unknown error",
        }).catch(() => {});

        throw err;
      }
    }

    case "remove-account": {
      const { mt5AccountDbId, userId, login } = data;

      log.info({ userId, login }, "[DeploymentWorker] Removing MT5 account");

      await deploymentService.removeAccount(mt5AccountDbId);

      log.info({ userId, login }, "[DeploymentWorker] MT5 account removed successfully");
      return { removed: true };
    }

    default: {
      const _exhaustive: never = data;
      throw new Error(`[DeploymentWorker] Unknown job type: ${(_exhaustive as AccountDeploymentJobData).type}`);
    }
  }
}

export function startDeploymentWorker(): Worker<AccountDeploymentJobData> {
  const worker = new Worker<AccountDeploymentJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info(
      { queue: QUEUE_NAME, jobId: job.id, type: job.data.type, result },
      "[DeploymentWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAME,
        jobId: job?.id,
        type: job?.data?.type,
        err,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts?.attempts,
      },
      "[DeploymentWorker] Job failed",
    );
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ queue: QUEUE_NAME, jobId }, "[DeploymentWorker] Job stalled — will be re-queued");
  });

  worker.on("error", (err) => {
    logger.error({ queue: QUEUE_NAME, err }, "[DeploymentWorker] Worker error");
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 5 }, "[DeploymentWorker] Started");
  return worker;
}
