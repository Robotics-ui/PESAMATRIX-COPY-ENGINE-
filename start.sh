#!/bin/bash
export PORT=8080
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379

# Start Redis in a new session so it survives exec (nohup + setsid detaches it fully)
nohup setsid redis-server --port 6379 --loglevel warning > /tmp/redis-prod.log 2>&1 &
echo "[startup] Redis starting..."

# Wait up to 15 seconds for Redis to be ready
for i in $(seq 1 30); do
  redis-cli -p 6379 ping > /dev/null 2>&1 && echo "[startup] Redis is ready" && break
  sleep 0.5
  if [ "$i" -eq 30 ]; then
    echo "[startup] WARNING: Redis did not become ready — continuing without it"
  fi
done

# Seed admin user (idempotent)
echo "[startup] Running admin seed..."
node scripts/dist/seed-admin.cjs && echo "[startup] Seed done" || echo "[startup] Seed failed (continuing)"

exec node --enable-source-maps artifacts/api-server/dist/index.mjs
