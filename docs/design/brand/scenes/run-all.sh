#!/bin/bash
# Re-split the scene sheets (empty / error / all-done states; docs/ART_PLAN.md G).
B=/Users/brianterchin/.claude/projects/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/tool-results/mcp-Claude_Browser-blob
cd "$(dirname "$0")/.."
while read -r blob key names; do
  [ -z "$blob" ] && continue
  OUTDIR=$PWD/scenes python3 poses/split-poses.py "$B-$blob.jpg" "$key" - "$names" >/dev/null && echo -n "$names "
done <<'LIST'
1790926782029-4txo7y green r-asleep,r-unplugged
LIST
echo
