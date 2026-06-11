#!/bin/bash
set -e
pnpm install
cd artifacts/pesamatrix && PORT=5000 BASE_PATH=/ pnpm run build
cd ../api-server && pnpm run build
