#!/bin/bash
set -e
pnpm install
cd artifacts/pesamatrix && PORT=5000 BASE_PATH=/ pnpm run build
cd ../api-server && pnpm run build
# Bundle seed script into a self-contained CJS file (pg uses CommonJS internally)
cd ../..
artifacts/api-server/node_modules/.bin/esbuild scripts/seed-admin.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=scripts/dist/seed-admin.cjs
echo "[build] Seed script bundled"
