#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Starting Sales Visits PWA Deployment"
echo "=========================================="

echo ">> 1. Fetching latest changes from GitHub..."
git pull origin main

echo ">> 2. Installing dependencies..."
pnpm install --frozen-lockfile

echo ">> 3. Running database migrations..."
pnpm db:migrate

echo ">> 4. Building production bundle..."
pnpm build

echo ">> 5. Reloading process in PM2..."
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

echo "=========================================="
echo " Deployment finished successfully!"
echo "=========================================="
