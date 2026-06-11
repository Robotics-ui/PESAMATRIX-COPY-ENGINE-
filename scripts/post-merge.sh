#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[post-merge] Pushing DB schema..."
pnpm --filter @workspace/db run push 2>/dev/null || echo "[post-merge] DB push skipped (DATABASE_URL may not be set)"

echo "[post-merge] Done."
