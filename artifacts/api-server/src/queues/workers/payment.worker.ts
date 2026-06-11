import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection.js";
import { paymentService } from "../../services/payment.service.js";
import { logger } from "../../lib/logger.js";
import type { PaymentJobData } from "../job-types.js";

const QUEUE_NAME = "PaymentQueue";

async function processJob(job: Job<PaymentJobData>): Promise<unknown> {
  const { data } = job;
  const log = logger.child({ queue: QUEUE_NAME, jobId: job.id, type: data.type });

  log.info({ attempt: job.attemptsMade + 1 }, "[PaymentWorker] Processing job");

  switch (data.type) {
    case "poll-payment-status": {
      const { paymentId, checkoutRequestId, userId } = data;

      log.info(
        { paymentId, checkoutRequestId },
        "[PaymentWorker] Polling payment status from Daraja",
      );

      const status = await paymentService.checkPaymentStatus(checkoutRequestId, userId);

      log.info(
        {
          paymentId,
          checkoutRequestId,
          status: status.status,
          resultCode: status.resultCode,
          mpesaRef: status.mpesaRef,
        },
        "[PaymentWorker] Payment status resolved",
      );

      if (status.status === "completed") {
        log.info(
          { paymentId, mpesaRef: status.mpesaRef, subscriptionId: status.subscriptionId },
          "[PaymentWorker] Payment confirmed — full activation already triggered by checkPaymentStatus",
        );
      } else if (status.status === "failed") {
        log.warn(
          { paymentId, resultCode: status.resultCode, resultDesc: status.resultDesc },
          "[PaymentWorker] Payment confirmed FAILED",
        );
      } else {
        log.info({ paymentId, status: status.status }, "[PaymentWorker] Payment still processing");

        if (job.attemptsMade < (job.opts.attempts ?? 4) - 1) {
          throw new Error(`Payment still processing — will retry (attempt ${job.attemptsMade + 1})`);
        }

        log.warn({ paymentId }, "[PaymentWorker] Max retry attempts reached for processing payment");
      }

      return status;
    }

  }
}

export function startPaymentWorker(): Worker<PaymentJobData> {
  const worker = new Worker<PaymentJobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 10,
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info(
      { queue: QUEUE_NAME, jobId: job.id, type: job.data.type, result },
      "[PaymentWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAME,
        jobId: job?.id,
        type: job?.data?.type,
        paymentId: (job?.data as PaymentJobData | undefined)?.paymentId,
        err,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts?.attempts,
      },
      "[PaymentWorker] Job failed",
    );
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ queue: QUEUE_NAME, jobId }, "[PaymentWorker] Job stalled");
  });

  worker.on("error", (err) => {
    logger.error({ queue: QUEUE_NAME, err }, "[PaymentWorker] Worker error");
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 10 }, "[PaymentWorker] Started");
  return worker;
}
