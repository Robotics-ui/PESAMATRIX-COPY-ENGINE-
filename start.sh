#!/bin/bash
export PORT=8080
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379
redis-server --daemonize yes --port 6379 2>/dev/null
sleep 0.5
# Seed admin user (idempotent — skips if already exists)
echo "[startup] Running admin seed..."
node scripts/dist/seed-admin.cjs && echo "[startup] Seed done" || echo "[startup] Seed failed (continuing)"
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
