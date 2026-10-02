#!/bin/bash
# Re-split the three game/UI icon sheets (see docs/ART_PLAN.md D/E).
B=/Users/brianterchin/.claude/projects/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/tool-results/mcp-Claude_Browser-blob
cd "$(dirname "$0")/.."
S=/tmp/wordo-icon-split; mkdir -p $S
OUTDIR=$PWD/games python3 poses/split-poses.py $B-1790924611053-3u0719.jpg cyan - practice,quordle,octordle,gauntlet,propernoundle,scramble,hub,groups,cryptogram >/dev/null
OUTDIR=$PWD/games python3 poses/split-poses.py $B-1790924845996-wcls9l.jpg magenta - vs,sequence,rescue,six,seven,more,x1,crossword,x2 >/dev/null
OUTDIR=$S python3 poses/split-poses.py $B-1790925000039-ospfki.jpg magenta - a,b,c,d,e,f,sudoku,h,ladder >/dev/null
cp $S/sudoku.png $S/ladder.png games/; rm -f games/x1.png games/x2.png
OUTDIR=$S python3 poses/split-poses.py $B-1790925192039-e5yc4a.jpg cyan - wordsearch,regions,badge-w,badge-l,badge-check,lock,bell,add-friend,share >/dev/null
cp $S/wordsearch.png $S/regions.png games/
for n in badge-w badge-l badge-check lock bell add-friend share; do cp $S/$n.png icons/$n-capture.png; done
OUTDIR=$S python3 poses/split-poses.py $B-1790925439024-29me11.jpg cyan - hub,sound,back >/dev/null
cp $S/hub.png games/; cp $S/sound.png icons/sound-capture.png; cp $S/back.png icons/back-capture.png
OUTDIR=$PWD/games python3 poses/split-poses.py $B-1790927640043-q7job2.jpg green - pocket-rps,pocket-ttt,pocket-coin,pocket-pass,pocket-ghost,pocket-chain >/dev/null
echo ok
