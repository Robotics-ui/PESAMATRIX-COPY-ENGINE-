#!/bin/bash
export PORT=8080
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379
redis-server --daemonize yes --port 6379 2>/dev/null
sleep 0.5
# Seed admin user on every boot (idempotent — no-ops if already exists)
cd scripts && pnpm exec tsx seed-admin.ts || echo "[startup] Admin seed skipped"
cd ..
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
