#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT"

mapfile -t DB_PARTS < <(node --input-type=module -e '
const url = new URL(process.env.DATABASE_URL);
const database = url.pathname.replace(/^\//, "").split("?")[0];
process.stdout.write([url.username, url.password, url.hostname, url.port || "3306", database].join("\n"));
')

DB_USER="${DB_PARTS[0]}"
DB_PASS="${DB_PARTS[1]}"
DB_HOST="${DB_PARTS[2]}"
DB_PORT="${DB_PARTS[3]}"
DB_NAME="${DB_PARTS[4]}"

echo "Dumping ${DB_NAME} from ${DB_HOST}:${DB_PORT}"
MYSQL_PWD="$DB_PASS" mysqldump \
  --single-transaction \
  --no-tablespaces \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  "$DB_NAME" | gzip > "$OUT/db-$STAMP.sql.gz"

UPLOADS="${UPLOAD_DIR:-uploads}"
if [[ -d "$UPLOADS" ]]; then
  tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$ROOT" "$UPLOADS"
else
  echo "No uploads directory at $UPLOADS; database dump only."
fi

echo "Backup written to $OUT"
