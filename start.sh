#!/bin/bash
set -e

export PORT=8080
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379

# Start Redis and wait until it is ready (up to 10 seconds)
redis-server --daemonize yes --port 6379 --logfile /tmp/redis-prod.log 2>/dev/null || true
echo "[startup] Waiting for Redis..."
for i in $(seq 1 20); do
  redis-cli -p 6379 ping > /dev/null 2>&1 && echo "[startup] Redis is ready" && break
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    echo "[startup] WARNING: Redis did not become ready in 10s — continuing anyway"
  fi
done

# Seed admin user (idempotent — skips if already exists)
echo "[startup] Running admin seed..."
node scripts/dist/seed-admin.cjs && echo "[startup] Seed done" || echo "[startup] Seed failed (continuing)"

exec node --enable-source-maps artifacts/api-server/dist/index.mjs
