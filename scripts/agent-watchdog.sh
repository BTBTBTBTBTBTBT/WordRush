#!/bin/bash
# Watchdog for agent-heavy sessions (founder 10-13: "always monitor this closely" + "we keep having an issue with stuck
# loops"). Run in the background while agents build; it exits (so the session is notified) only on low disk.
#
#   scripts/agent-watchdog.sh [--min-gb 2] [--hours 4] [--log FILE]
#
# Every 60 s:
#   - disk: exits with "DISK LOW" when `df -g /` free space is under --min-gb;
#   - stale waits (running > 10 min): any shell loop polling a background task's .output file (`until … tasks/<id>.output …`) whose task
#     already ended (the file has the harness footer "[exited with code N]" / "[killed]") is killed and logged —
#     that marker it waits for can never come.
set -u
min=2; hours=4; log=/dev/stderr
while [ $# -gt 0 ]; do
  case "$1" in
    --min-gb) min=$2; shift 2;;
    --hours) hours=$2; shift 2;;
    --log) log=$2; shift 2;;
    *) echo "agent-watchdog: unknown option $1" >&2; exit 64;;
  esac
done
end=$(( $(date +%s) + hours * 3600 ))
while [ "$(date +%s)" -lt "$end" ]; do
  free=$(df -g / | awk 'NR==2{print $4}')
  if [ "$free" -lt "$min" ]; then echo "DISK LOW: ${free} GB free at $(date +%H:%M)"; exit 0; fi
  # Stale polls: `until` loops whose command line names a tasks/*.output file.
  # Only loops older than 10 min (`etime`), so a fresh command that merely mentions such a file is never touched.
  ps -axww -o pid=,etime=,command= | grep -E 'until .*tasks/[A-Za-z0-9]+\.output' | grep -v grep | while read -r pid etime cmd; do
    secs=$(printf '%s' "$etime" | awk -F'[-:]' '{n=NF; s=$n+60*$(n-1); if(n>=3) s+=3600*$(n-2); if(n==4) s+=86400*$1; print s}')
    [ "${secs:-0}" -ge 600 ] || continue
    out=$(printf '%s' "$cmd" | grep -oE '/[^ "]*tasks/[A-Za-z0-9]+\.output' | head -1)
    [ -n "$out" ] || continue
    if grep -qE '^\[(exited with code|killed)' "$out" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "$(date +%H:%M) killed stale wait pid $pid (watched $(basename "$out") already ended)" >> "$log"
    fi
  done
  sleep 60
done
echo "agent-watchdog ended after ${hours} h (last ${free} GB free)"
