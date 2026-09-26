#!/usr/bin/env bash
# Apply a hand migration to PRODUCTION (founder authorization 2026-09-26: the
# assistant drives hand-applied SQL). Always run scripts/db-backup.sh first.
#
#   scripts/db-apply.sh supabase/manual-migrations/<file>.sql      # apply, stop on first error
#   scripts/db-apply.sh --query "select count(*) from profiles"    # one read-back query, aligned/tuples-only
#
# The connection string is read from ~/.wordocious-db-url and never printed.
set -euo pipefail
PG_BIN="${PG_BIN:-/opt/homebrew/opt/libpq/bin}"
URL_FILE="${WORDOCIOUS_DB_URL_FILE:-$HOME/.wordocious-db-url}"
[[ -r "$URL_FILE" ]] || { echo "No connection string at $URL_FILE" >&2; exit 1; }
[[ -x "$PG_BIN/psql" ]] || { echo "psql not found at $PG_BIN — brew install libpq" >&2; exit 1; }
DB_URL="$(tr -d '\r\n' < "$URL_FILE")"
if [[ "${1:-}" == "--query" ]]; then
  shift
  exec "$PG_BIN/psql" "$DB_URL" -X -At -v ON_ERROR_STOP=1 -c "$1"
fi
FILE="${1:?usage: db-apply.sh <file.sql> | --query <sql>}"
[[ -r "$FILE" ]] || { echo "No such file: $FILE" >&2; exit 1; }
echo "== APPLY $FILE =="
"$PG_BIN/psql" "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$FILE"
echo "== APPLIED =="
