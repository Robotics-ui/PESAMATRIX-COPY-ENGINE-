import { Queue, type DefaultJobOptions } from "bullmq";
import { getRedisConnection } from "./connection.js";
import type {
  AccountDeploymentJobData,
  CopyFactoryJobData,
  SubscriptionJobData,
  PaymentJobData,
  NotificationJobData,
} from "./job-types.js";

const REMOVE_ON_COMPLETE: DefaultJobOptions["removeOnComplete"] = {
  age: 24 * 60 * 60,
  count: 5_000,
};

const REMOVE_ON_FAIL: DefaultJobOptions["removeOnFail"] = {
  age: 7 * 24 * 60 * 60,
  count: 1_000,
};

function makeQueue<TData>(name: string, defaultJobOptions?: DefaultJobOptions) {
  return new Queue<TData, unknown, string>(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: REMOVE_ON_COMPLETE,
      removeOnFail: REMOVE_ON_FAIL,
      ...defaultJobOptions,
    },
  });
}

export const AccountDeploymentQueue = makeQueue<AccountDeploymentJobData>(
  "AccountDeploymentQueue",
  {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
  },
);

export const CopyFactoryQueue = makeQueue<CopyFactoryJobData>(
  "CopyFactoryQueue",
  {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
  },
);

export const SubscriptionQueue = makeQueue<SubscriptionJobData>(
  "SubscriptionQueue",
  {
    attempts: 3,
    backoff: { type: "exponential", delay: 3_000 },
  },
);

export const PaymentQueue = makeQueue<PaymentJobData>(
  "PaymentQueue",
  {
    attempts: 4,
    backoff: { type: "fixed", delay: 5_000 },
  },
);

export const NotificationQueue = makeQueue<NotificationJobData>(
  "NotificationQueue",
  {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
  },
);

export const ALL_QUEUES = [
  AccountDeploymentQueue,
  CopyFactoryQueue,
  SubscriptionQueue,
  PaymentQueue,
  NotificationQueue,
] as const;

export async function getQueueStats() {
  const stats = await Promise.all(
    ALL_QUEUES.map(async (q) => {
      const [active, waiting, delayed, failed, completed, paused] =
        await Promise.all([
          q.getActiveCount(),
          q.getWaitingCount(),
          q.getDelayedCount(),
          q.getFailedCount(),
          q.getCompletedCount(),
          q.getJobCounts("paused").then((c) => c.paused ?? 0),
        ]);
      return {
        name: q.name,
        active,
        waiting,
        delayed,
        failed,
        completed,
        paused,
      };
    }),
  );
  return stats;
}

export async function getFailedJobs(queueName?: string) {
  const queues = queueName
    ? ALL_QUEUES.filter((q) => q.name === queueName)
    : ALL_QUEUES;

  const results = await Promise.all(
    queues.map(async (q) => {
      const jobs = await q.getFailed(0, 49);
      return {
        queue: q.name,
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp,
          finishedOn: j.finishedOn,
          stacktrace: j.stacktrace?.slice(-1),
        })),
      };
    }),
  );

  return results;
}
