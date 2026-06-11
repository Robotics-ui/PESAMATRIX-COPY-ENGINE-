import IORedis from "ioredis";
import { logger } from "../lib/logger.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function buildConnection(): IORedis {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times: number) {
      if (times > 10) {
        logger.error({ times }, "[Redis] Too many retries — giving up");
        return null;
      }
      const delay = Math.min(times * 500, 5000);
      logger.warn({ times, delay }, "[Redis] Reconnecting");
      return delay;
    },
  });

  conn.on("connect", () => logger.info("[Redis] Connected"));
  conn.on("error", (err) => logger.error({ err }, "[Redis] Connection error"));
  conn.on("close", () => logger.warn("[Redis] Connection closed"));

  return conn;
}

let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    _connection = buildConnection();
  }
  return _connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit().catch(() => _connection?.disconnect());
    _connection = null;
    logger.info("[Redis] Connection closed");
  }
}
