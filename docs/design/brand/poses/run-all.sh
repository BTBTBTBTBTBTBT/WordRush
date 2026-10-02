#!/bin/bash
# Re-split every pose sheet capture (ids → screenshot blob, key, pose names).
B=/Users/brianterchin/.claude/projects/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/tool-results/mcp-Claude_Browser-blob
cd "$(dirname "$0")"
while read -r blob key id names; do
  [ -z "$blob" ] && continue
  echo -n "$id: "; python3 split-poses.py "$B-$blob.jpg" "$key" "$id" "$names" | sed 's/.*poses\///' | tr '\n' ' '; echo
done <<'LIST'
1790921931627-uw5e6j cyan w sit,cheer,lean
1790922041855-hrjwse cyan o1 sit,cheer,lean
1790923425169-58mjdz magenta r sit,cheer,lean
1790923316812-6sszc4 magenta d sit,cheer,lean
1790922372374-bc1htz cyan o2 sit,cheer,lean
1790921740787-a3dv4k magenta c sit,cheer,lean
1790922480175-4k0am5 magenta i sit,cheer,lean
1790922724712-uciclq cyan o3 sit,handstand,sneak
1790923062684-x9ww9e cyan u meditate,spin,stretch
1790922949098-2upz1c cyan s sit,slide,flex
LIST
