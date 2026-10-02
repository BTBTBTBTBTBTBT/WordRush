#!/bin/bash
# Re-capture every title from its ChatGPT screenshot (blob, key, name).
B=/Users/brianterchin/.claude/projects/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/tool-results/mcp-Claude_Browser-blob
cd "$(dirname "$0")"
while read -r blob key name; do
  [ -z "$blob" ] && continue
  python3 capture-title.py "$B-$blob.jpg" auto "$name" "$key" >/dev/null && echo -n "$name "
done <<'LIST'
1790919864979-9uiqpa green monday
1790920165667-t04p38 cyan tuesday
1790920270500-8yu54t cyan wednesday
1790920377699-u9p82r cyan thursday
1790922594427-pxb9ha cyan friday
1790920475698-ajj8rp cyan saturday
1790920677165-ruz03j cyan sunday
1790921315156-6th5th cyan friends-lettering
1790921504139-rwsy94 cyan stats-lettering
1790923821026-6tz10l cyan records-vs
1790924029584-7u06ir cyan puzzles-wotd
1790924128277-eol0ft cyan settings-howto
1790924277188-fcqhds cyan gopro-more
1790926093547-bwmvon cyan victory-close
1790926243029-d6tvoy cyan sweep-flawless-win
1790926428997-65mmzj cyan lose-draw-record-streak
1790927432006-uogvfe cyan welcome-leaderboard
LIST
python3 split-lines.py records-vs-keyed.png records,vs >/dev/null
python3 split-lines.py puzzles-wotd-keyed.png puzzles,wotd >/dev/null
python3 split-lines.py settings-howto-keyed.png settings,howto >/dev/null
python3 split-lines.py gopro-more-keyed.png gopro,moregames >/dev/null
python3 split-lines.py victory-close-keyed.png victory,soclose >/dev/null
python3 split-lines.py sweep-flawless-win-keyed.png sweep,flawless,youwin >/dev/null
python3 split-lines.py lose-draw-record-streak-keyed.png youlose,draw,newrecord,streak >/dev/null
python3 split-lines.py welcome-leaderboard-keyed.png welcome,leaderboard >/dev/null
echo
