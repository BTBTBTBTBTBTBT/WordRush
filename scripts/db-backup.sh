#!/usr/bin/env bash
# Full logical backup of the production Supabase database.
#
# The project is on the Supabase Free plan (no PITR, no scheduled backups —
# checked 2026-09-22), so THIS is the restore path. Run it before any
# hand-applied SQL against production (see supabase/manual-migrations/).
#
# The connection string never appears in a command line, a log or a chat: it is
# read from a file the founder writes himself (chmod 600):
#
#   ~/.wordocious-db-url   →  postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres
#
# (Supabase dashboard → Connect → "Session pooler" URI, with the database
# password filled in. Use the session pooler, port 5432: the direct host is
# IPv6-only on the Free plan.)
#
# Output: ~/Backups/wordocious/<UTC timestamp>/
#   full.dump    pg_dump custom format (schema + data, all schemas pg_dump can
#                read as the postgres role) — restore with pg_restore
#   schema.sql   plain-text schema only (public + auth-adjacent objects), for diffing
#   tables.txt   row counts per public table, so a restore can be checked
#
# Usage:  bash scripts/db-backup.sh
set -euo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/libpq/bin}"
URL_FILE="${WORDOCIOUS_DB_URL_FILE:-$HOME/.wordocious-db-url}"
OUT_ROOT="${WORDOCIOUS_BACKUP_DIR:-$HOME/Backups/wordocious}"

if [[ ! -r "$URL_FILE" ]]; then
  echo "No connection string at $URL_FILE — write it there (chmod 600) first." >&2
  exit 1
fi
if [[ ! -x "$PG_BIN/pg_dump" ]]; then
  echo "pg_dump not found at $PG_BIN — brew install libpq" >&2
  exit 1
fi

# Read the URL once, strip a trailing newline, never echo it.
DB_URL="$(tr -d '\r\n' < "$URL_FILE")"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_ROOT/$STAMP"
mkdir -p "$OUT"
chmod 700 "$OUT_ROOT" "$OUT"

echo "→ full dump (custom format)…"
"$PG_BIN/pg_dump" "$DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --file="$OUT/full.dump"

echo "→ schema-only SQL…"
"$PG_BIN/pg_dump" "$DB_URL" --schema-only --no-owner --no-privileges \
  --schema=public --file="$OUT/schema.sql"

echo "→ row counts…"
"$PG_BIN/psql" "$DB_URL" --quiet --tuples-only --no-align --field-separator=$'\t' \
  --command="select relname, n_live_tup from pg_stat_user_tables where schemaname='public' order by relname" \
  > "$OUT/tables.txt"

chmod 600 "$OUT"/*
echo
echo "Backup written to $OUT"
du -sh "$OUT"/* | sed 's|.*/||'
echo
echo "Restore (to a NEW project, never over production):"
echo "  $PG_BIN/pg_restore --no-owner --no-privileges --dbname=<target url> $OUT/full.dump"
