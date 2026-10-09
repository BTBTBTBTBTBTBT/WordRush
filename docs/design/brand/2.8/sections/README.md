# Section titles + stat bits (FRIDAY-QUEUE items 16 / 17 / 25 / 36)
DECISION: the section titles are rendered from the bubble GLYPH ATLAS (`make-titles.py`), not drawn one by one in ChatGPT: identical
lettering to DAILIES/PUZZLES by construction, crisp at any width, tintable (cast color or Halloween black + orange rim) and new titles
are free. `out/title-*.png` (+ `-halloween`): MY GAMES (W purple), HEAD TO HEAD (D blue), BOTS (R slate), GUESSES (C teal), ACTIVITY
(I green), POCKET GAMES (S gold), TROPHY CASE (O1 amber), HIGHLIGHTS (O3 orange), LATELY (U violet), THEME (W), KEYBOARD (D),
SOUND & FEEDBACK (C), NOTIFICATIONS (O2 pink), ACCOUNT (I), HELP (S). Apps should render live with the same atlas; PNGs are previews.
`stats/`: code-drawn win-rate ring (+ track, Halloween) and two-color record bar (`make-stat-bits.py`); stat icons (smiling stopwatch,
target, crown, bolt, star, donut) are in `../icons/stats`, Settings row icons in `../icons/settings`, medals + trophy shelf +
friendship badge + heart tag in `../icons/medals`.
