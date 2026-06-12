#!/bin/bash
set -e

export PORT=8080
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379

# Start Redis as a background process (daemonize is unreliable in some containers)
redis-server --port 6379 --logfile /tmp/redis-prod.log --daemonize no &
REDIS_PID=$!
echo "[startup] Redis started (pid=$REDIS_PID)"

# Wait until Redis is ready (up to 15 seconds)
echo "[startup] Waiting for Redis..."
for i in $(seq 1 30); do
  redis-cli -p 6379 ping > /dev/null 2>&1 && echo "[startup] Redis is ready" && break
  sleep 0.5
  if [ "$i" -eq 30 ]; then
    echo "[startup] WARNING: Redis did not become ready in 15s — continuing anyway"
  fi
done

# Seed admin user (idempotent — skips if already exists)
echo "[startup] Running admin seed..."
node scripts/dist/seed-admin.cjs && echo "[startup] Seed done" || echo "[startup] Seed failed (continuing)"

exec node --enable-source-maps artifacts/api-server/dist/index.mjs
