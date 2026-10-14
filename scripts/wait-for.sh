#!/bin/bash
# Bounded wait (founder 10-13: "we keep having an issue with stuck loops"). Every wait in this repo — mine and every
# agent's — goes through this instead of a hand-written `until ...; do sleep; done`, which hung three times on 10-13
# (a vercel poll read the wrong stream for 3 h; two agent polls waited on tasks that had been killed).
#
#   scripts/wait-for.sh --max 900 [--every 15] [--pid 1234] [--task-output FILE] -- <check command...>
#
# Runs <check command> every --every seconds until it succeeds (exit 0), then exits 0.
# Exits 2 on timeout (--max seconds), 3 when the watched --pid is gone, 3 when --task-output shows the task ended
# ("[exited with code" / "[killed" — the harness's footer) before the check passed. Always prints why it stopped.
set -u
max=600; every=10; pid=""; task=""
while [ $# -gt 0 ]; do
  case "$1" in
    --max) max=$2; shift 2;;
    --every) every=$2; shift 2;;
    --pid) pid=$2; shift 2;;
    --task-output) task=$2; shift 2;;
    --) shift; break;;
    *) echo "wait-for: unknown option $1" >&2; exit 64;;
  esac
done
[ $# -gt 0 ] || { echo "wait-for: no check command (put it after --)" >&2; exit 64; }
start=$(date +%s)
while :; do
  if "$@" >/dev/null 2>&1; then echo "wait-for: done after $(( $(date +%s) - start ))s"; exit 0; fi
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then echo "wait-for: pid $pid is gone"; exit 3; fi
  if [ -n "$task" ] && grep -qE '^\[(exited with code|killed)' "$task" 2>/dev/null; then echo "wait-for: task ended ($(grep -oE '^\[(exited with code [0-9]+|killed)' "$task" | tail -1))"; exit 3; fi
  if [ $(( $(date +%s) - start )) -ge "$max" ]; then echo "wait-for: timed out after ${max}s"; exit 2; fi
  sleep "$every"
done
