#!/bin/sh
set -e

echo "[startup] Running database migrations..."
pnpm push-force || echo "[startup] Migration warning (may already be up to date)"

echo "[startup] Starting server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
