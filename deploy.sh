#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " Starting Sales Visits PWA Deployment"
echo "=========================================="

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

PORT="${PORT:-3000}"

echo ">> 1. Fetching latest changes from GitHub..."
git pull origin main

echo ">> 2. Installing dependencies..."
pnpm install --frozen-lockfile

echo ">> 3. Running TypeScript check and test suite..."
pnpm run check
pnpm test

echo ">> 4. Running database migrations..."
pnpm db:migrate

echo ">> 5. Building production bundle..."
pnpm build

echo ">> 6. Reloading process in PM2..."
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

echo ">> 7. Verifying application health on http://127.0.0.1:${PORT}/api/health ..."
for i in {1..15}; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "Health check passed!"
    echo "=========================================="
    echo " Deployment finished successfully!"
    echo "=========================================="
    exit 0
  fi
  sleep 1
done

echo "ERROR: Application failed health check after deployment."
exit 1
