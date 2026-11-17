#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/uploads
  chown -R node:node /app/uploads
  exec su -s /bin/sh node -c 'cd /app && node ./node_modules/drizzle-kit/bin.cjs migrate && exec node dist/index.js'
fi

cd /app
echo "Applying database migrations..."
node ./node_modules/drizzle-kit/bin.cjs migrate
exec node dist/index.js
