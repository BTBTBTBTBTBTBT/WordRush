"""Builds sounds/lab.html, the Wordocious Sound Lab v2 (founder 10-05: "show the current sound next to
other options … break it down by the individual games … getting a feel for the sounds when things are pressed").
  python3 docs/design/brand/sounds/make-sound-options.py   # (re)synthesizes sounds/options/*.m4a
  python3 docs/design/brand/sounds/build-lab.py            # -> sounds/lab.html (self-contained, base64 audio)
One section per game, one row per event in that game (mapped from the real code on web / iOS / Android): the CURRENT
sound on the left, A/B/C options to its right, a "Pick" chip on each (saved in localStorage), "Play in sequence" per
game (current set, or my picks), and "Copy my picks" (plain text to paste back to Claude)."""
import base64, html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OPT = os.path.join(HERE, 'options'); CUR = os.path.join(HERE, 'out')
E = html.escape

# ── Clips ───────────────────────────────────────────────────────────────────
AUDIO = {}
def clip(key):
    """'cur-<name>' = the shipped sound (out/), anything else = options/<key>.m4a. Returns the key."""
    if key not in AUDIO:
        p = os.path.join(CUR, key[4:] + '.m4a') if key.startswith('cur-') else os.path.join(OPT, key + '.m4a')
        with open(p, 'rb') as f: AUDIO[key] = base64.b64encode(f.read()).decode()
    return key

ALT = {  # the three alternatives synthesized for every shipped sound: A softer · B brighter · C more playful
    'tap': ('Felt', 'Glass', 'Bubble'), 'delete': ('Felt back', 'Glass tick-tock', 'Bubble drop'),
    'flip': ('Soft card', 'Glass click', 'Wood block'), 'press': ('Pillow', 'Bright pop', 'Rubber squeak'),
    'release': ('Soft', 'Bright', 'Wobble'), 'hop': ('Soft boing', 'Spring', 'Boing-oing'),
    'invalid': ('Soft "hmm"', 'Two bells down', '"Uh-uh" voice'), 'win': ('Marimba', 'Glock sparkle', 'Boing ta-da'),
    'lose': ('Music box', 'Hopeful glock', 'Soft "aww"'), 'celebrate': ('Music-box rise', 'Confetti shimmer', 'Slide whistle + pops'),
    'streak': ('Warm ding', 'Bright double ding', 'Fwoomp + boing'), 'tick': ('Soft', 'Glock', '8-bit'),
    'notify': ('Music-box coin', 'Glock coin', '8-bit coin'), 'vs': ('Soft drum', 'Bright two-hit', 'Ding-ding!'),
    'whoosh': ('Low breeze', 'Airy + chime', 'Swish-pop'),
}
def alts(sound):
    if sound == 'unlock':
        return [('achieve-a', 'A', 'Badge Shine'), ('achieve-b', 'B', 'Treasure Pop'), ('alt-unlock-c', 'C', 'Boing fanfare')]
    return [(f'alt-{sound}-{k}', k.upper(), ALT[sound][i]) for i, k in enumerate('abc')]
CUR_NAME = {'notify': 'notify (the coin)'}

def row(rid, event, current, note='', options=None):
    """One event: `current` = a shipped sound name (or None = silent today); options default to its A/B/C alternatives."""
    opts = options if options is not None else alts(current)
    return dict(id=rid, event=event, note=note, cur=clip('cur-' + current) if current else None,
                curName=CUR_NAME.get(current, current) if current else 'none',
                opts=[dict(k=clip(k), l=l, n=n) for k, l, n in opts])
def grid_row(rid, event, current, note, sets, labels):
    return dict(id=rid, event=event, note=note, cur=clip('cur-' + current) if current else None,
                curName=CUR_NAME.get(current, current) if current else 'none', grid=True, labels=labels,
                sets=[dict(l=l, n=n, keys=[clip(k) for k in keys]) for l, n, keys in sets])

# ── Word games (Classic family) ─────────────────────────────────────────────
WIN_NOTE = 'iOS plays it the moment the game is won; web and Android when the finish popup opens.'
def word_rows(multi=False, gauntlet=False, vs=False):
    r = [row('key', 'Letter key', 'tap', 'Every letter on the keyboard. Its pitch wobbles ±3% so typing never sounds robotic.'),
         row('enter', 'Enter', 'tap', 'The same tap as a letter (web adds a firmer haptic).'),
         row('delete', 'Delete', 'delete'),
         row('invalid', 'Not a word / too short / already guessed', 'invalid', 'The row shakes.'),
         row('flip', 'Tile flip (the reveal)', 'flip', 'One per tile, 150 ms apart, on every guess. Several boards flipping together play once.')]
    if multi:
        r.append(row('board', 'A board solved (game still going)', 'notify',
                     'iOS only: the coin at 70%. Web and Android play nothing here yet.'))
    if gauntlet:
        r.append(row('stage', 'A stage cleared', 'notify', 'iOS only: the coin at 70%. Web and Android play nothing here yet.'))
    if vs: return r
    r += [row('popup', 'Finish popup slides in', 'whoosh', 'Android also plays a mascot hop as the popup lands.'),
          row('win', 'Win', 'win', WIN_NOTE),
          row('loss', 'Loss (out of guesses)', 'lose'),
          row('tick', 'Points counting up', 'tick', 'Up to 12 a second on the finish popup.'),
          row('streak', 'Streak +1', 'streak', 'Web: as the streak chip pops on the finish popup. iOS: when the header streak ticks up. '
                                               'Android: not here (only when a shield saves a streak).')]
    if gauntlet:
        r.append(row('champion', 'Gauntlet champion', 'celebrate', 'Finishing every stage. All three platforms.'))
    return r

def word_seq(n, multi=False, gauntlet=False, invalid_first=False, finish='win'):
    s, t = [], 300
    def typ(k):
        nonlocal t
        for _ in range(k): s.append(['key', t]); t += 190
    if invalid_first:
        typ(n); s.append(['enter', t]); t += 140; s.append(['invalid', t]); t += 650
        for _ in range(n): s.append(['delete', t]); t += 110
        t += 250
    for g in range(2):
        typ(n); s.append(['enter', t]); t += 260
        for i in range(n): s.append(['flip', t + i * 150])
        t += n * 150 + 450
        if g == 0 and multi: s.append(['board', t]); t += 650
        if g == 0 and gauntlet: s.append(['stage', t]); t += 650
    s.append(['popup', t]); s.append([finish, t + 90]); t += 900
    for k in range(8): s.append(['tick', t + k * 84])
    t += 8 * 84 + 350
    s.append(['champion' if gauntlet else 'streak', t])
    return s

def puzzle_end():
    return [row('win', 'Puzzle solved', 'win', 'Plays as the puzzle ends.'), row('loss', 'Puzzle ends unsolved', 'lose')]

GAMES = []
def game(gid, title, blurb, rows, seq): GAMES.append(dict(id=gid, title=title, blurb=blurb, rows=rows, seq=seq))

game('classic', 'Classic', 'Five letters, six guesses.', word_rows(), word_seq(5))
game('six', 'Six', 'Six letters.', word_rows(), word_seq(6))
game('seven', 'Seven', 'Seven letters.', word_rows(), word_seq(7))
game('quadword', 'QuadWord', 'Four boards at once.', word_rows(multi=True), word_seq(5, multi=True))
game('octoword', 'OctoWord', 'Eight boards at once.', word_rows(multi=True), word_seq(5, multi=True))
game('succession', 'Succession', 'Boards one after another.', word_rows(multi=True), word_seq(5, multi=True))
game('deliverance', 'Deliverance', 'Rescue the boards.', word_rows(multi=True), word_seq(5, multi=True))
game('gauntlet', 'Gauntlet', 'Stage after stage.', word_rows(gauntlet=True), word_seq(5, gauntlet=True))
game('propernoundle', 'ProperNoundle', 'Guess the famous name.', word_rows(), word_seq(5, invalid_first=True))

# ── Puzzles ─────────────────────────────────────────────────────────────────
TIERS = ['4', '5', '6', '7', '8+']
game('hubbub', 'Hubbub', 'Johnny\'s favorite: the coin for every word found. New ideas: bigger coins for longer words and a 1-up for a pangram.', [
    row('key', 'Letter hex', 'tap', 'Tapping a letter in the hive.'),
    row('shuffle', 'Shuffle', 'tap'),
    row('delete', 'Delete', 'delete'),
    row('invalid', 'Not a word / too short / missing the center letter', 'invalid'),
    row('found', 'A word found (the "Hubbub coin")', 'notify', 'The coin at 70% volume. Same on all three platforms.'),
    grid_row('tiers', 'NEW: longer words get a bigger coin', 'notify', 'Today every word plays the same coin. Tap a word length (4 to 8+ letters) to hear it.',
             [('A', 'Pitch climb: the same coin, higher for longer words', [f'tier-a-{x}' for x in TIERS]),
              ('B', 'Coin stack: one more coin per extra letter', [f'tier-b-{x}' for x in TIERS])], TIERS),
    row('pangram', 'NEW: a pangram (all seven letters) gets a 1-up', 'notify', 'Today a pangram plays the plain coin.',
        [('pangram-a', 'A', 'Coin Cascade'), ('pangram-b', 'B', 'Triple Coin Climb'), ('pangram-c', 'C', 'Sparkle Bloom')]),
    row('hint', 'Hint', 'tap', 'Web plays the tap when a hint is used.'),
    row('win', 'Reaching the top rank', 'win'), row('loss', 'Time\'s up below Hubbub rank', 'lose')],
    [['key', 300], ['key', 480], ['key', 660], ['key', 840], ['found', 1150],
     ['key', 1650], ['key', 1830], ['key', 2010], ['key', 2190], ['key', 2370], ['tiers', 2700, 1],
     ['key', 3300], ['key', 3480], ['key', 3660], ['invalid', 3950],
     ['shuffle', 4600], ['key', 5000], ['key', 5160], ['key', 5320], ['key', 5480], ['key', 5640], ['key', 5800], ['key', 5960], ['pangram', 6300],
     ['win', 7900]])
game('sudocious', 'Sudocious', 'Number puzzle.', [
    row('pad', 'Number pad / pencil marks', 'tap'),
    row('wrong', 'A wrong digit (or tapping a given)', 'invalid'), *puzzle_end()],
    [['pad', 300], ['pad', 700], ['pad', 1100], ['wrong', 1500], ['pad', 2200], ['pad', 2600], ['win', 3200]])
game('muddle', 'Muddle', 'Unscramble the words, then the punchline.', [
    row('key', 'Letter tiles and keys', 'tap'),
    row('back', 'Back / clear', 'delete', 'iOS and Android play delete; web plays the tap.'),
    row('wrong', 'Not that word / not the punchline', 'invalid'),
    row('step', 'A word unscrambled', 'notify', 'The coin at 70%.'), *puzzle_end()],
    [['key', 300], ['key', 480], ['key', 660], ['key', 840], ['wrong', 1150], ['back', 1800], ['back', 1950],
     ['key', 2200], ['key', 2380], ['step', 2700], ['key', 3300], ['key', 3480], ['key', 3660], ['step', 3950], ['win', 4700]])
game('crossword', 'Crosswordocious', 'The crossword.', [
    row('key', 'Letter key / clearing a cell', 'tap'),
    row('tools', 'Clues, Check, Reveal letter / word buttons', 'tap'),
    row('wrong', 'Check finds wrong letters (they clear)', 'invalid'),
    row('right', 'Check: everything filled is right', 'notify', 'The coin at 70%.'), *puzzle_end()],
    [['key', 300], ['key', 480], ['key', 660], ['key', 840], ['tools', 1200], ['wrong', 1400],
     ['key', 2100], ['key', 2280], ['tools', 2700], ['right', 2900], ['win', 3800]])
game('codebreaker', 'Codebreaker', 'Crack the cipher.', [
    row('key', 'Letter key / picking a cipher cell', 'tap'),
    row('hint', 'Hint / Check buttons', 'tap'),
    row('wrong', 'Check finds wrong letters', 'invalid'),
    row('right', 'Check: everything penciled is right', 'notify', 'The coin at 70%.'), *puzzle_end()],
    [['key', 300], ['key', 480], ['key', 660], ['hint', 1000], ['wrong', 1200], ['key', 1900], ['key', 2080],
     ['hint', 2400], ['right', 2600], ['win', 3500]])
game('kindred', 'Kindred', 'Find the groups of four.', [
    row('select', 'Selecting a word', 'tap'),
    row('shuffle', 'Shuffle / Deselect', 'tap'),
    row('wrong', 'Not a group / one away', 'invalid', 'The tiles shake.'),
    row('group', 'A group solved', 'notify', 'The coin at 70%.'), *puzzle_end()],
    [['select', 300], ['select', 600], ['select', 900], ['select', 1200], ['wrong', 1500], ['shuffle', 2200],
     ['select', 2600], ['select', 2900], ['select', 3200], ['select', 3500], ['group', 3800], ['win', 4700]])
game('ladder', 'Letter Ladder', 'Change one letter at a time.', [
    row('key', 'Letter key', 'tap'), row('delete', 'Delete', 'delete'),
    row('invalid', 'Not a word / not one letter changed', 'invalid'),
    row('rung', 'A rung climbed', 'notify', 'iOS plays the coin at 70%. Web plays only the tap. Android plays nothing.'),
    row('tools', 'Undo / Hint', 'tap'), *puzzle_end()],
    [['key', 300], ['key', 480], ['key', 660], ['key', 840], ['rung', 1150], ['key', 1700], ['key', 1880], ['key', 2060],
     ['key', 2240], ['invalid', 2550], ['delete', 3100], ['tools', 3400], ['key', 3800], ['key', 3980], ['key', 4160],
     ['key', 4340], ['rung', 4650], ['win', 5400]])
game('spyglass', 'Spyglass', 'Word search with a theme.', [
    row('near', 'Fits the theme but isn\'t one of today\'s 10', 'tap'),
    row('found', 'A word found', 'notify', 'The coin at 70%.'),
    row('miss', 'Not one of the words', 'invalid'),
    row('hint', 'Hint', 'tap'), *puzzle_end()],
    [['found', 300], ['miss', 1100], ['near', 1800], ['hint', 2400], ['found', 2800], ['found', 3500], ['win', 4300]])
game('starsweep', 'Starsweep', 'Place the stars.', [
    row('pad', 'Placing a star / a mark', 'tap'),
    row('wrong', 'A star in the wrong spot (or a locked cell)', 'invalid'), *puzzle_end()],
    [['pad', 300], ['pad', 650], ['pad', 1000], ['wrong', 1350], ['pad', 2000], ['pad', 2350], ['win', 3000]])

# ── VS, pocket games, across the app ───────────────────────────────────────
vs_rows = [row('match', 'Match found + the intro splash', 'vs', 'One stinger: the splash\'s copy collapses into it.')] + word_rows(vs=True) + [
    row('opp', 'Your opponent lands a row', 'flip', 'A softer flip: 50% on web, 70% on Android, 80% on iOS.'),
    row('win', 'You win', 'win'), row('loss', 'You lose', 'lose'),
    row('ladder', 'Top of the bot ladder cleared', 'celebrate', 'iOS also plays streak for a ladder milestone.')]
vs_seq = [['match', 300]]; t = 1500
for g in range(2):
    for _ in range(5): vs_seq.append(['key', t]); t += 190
    vs_seq.append(['enter', t]); t += 260
    for i in range(5): vs_seq.append(['flip', t + i * 150])
    t += 1200; vs_seq.append(['opp', t]); t += 600
vs_seq.append(['win', t])
game('vs', 'VS', 'Head-to-head matches.', vs_rows, vs_seq)

game('pocket', 'Pocket games', 'Pass, Ghost, Chain, Coin Flip and Tic-tac-toe with friends. Silent today (iOS gives a light haptic); these are ideas.', [
    row('move', 'Your move', None, '', [('alt-press-b', 'A', 'Bright pop'), ('alt-tap-c', 'B', 'Bubble'), ('alt-flip-c', 'C', 'Wood block')]),
    row('turn', 'Your friend moved: your turn', None, '', [('pocket-turn-a', 'A', 'Music-box nudge'), ('pocket-turn-b', 'B', 'Pop + chime'), ('alt-notify-a', 'C', 'Music-box coin')]),
    row('win', 'You win', None, '', [('alt-win-a', 'A', 'Marimba'), ('alt-win-b', 'B', 'Glock sparkle'), ('cur-win', 'C', 'The main win')]),
    row('loss', 'You lose or draw', None, '', [('alt-lose-a', 'A', 'Music box'), ('alt-lose-b', 'B', 'Hopeful glock'), ('cur-lose', 'C', 'The main loss')])],
    [['move', 300], ['turn', 1200], ['move', 2300], ['turn', 3200], ['move', 4300], ['win', 5000]])

CAST = [('w', 'W', '#7c3aed'), ('o1', 'O', '#f59e0b'), ('r', 'R', '#94a3b8'), ('d', 'D', '#2563eb'), ('o2', 'O', '#ec4899'),
        ('c', 'C', '#0891b2'), ('i', 'I', '#059669'), ('o3', 'O', '#f97316'), ('u', 'U', '#7e22ce'), ('s', 'S', '#ca8a04')]
laugh = grid_row('laugh', 'NEW: tap a hero in the header to hear it laugh', None,
                 'No sound or tap target today. Bright for W and O, sleepy for R, nerdy blips for D, a calm hum for U.',
                 [('A', 'Giggles: tiny synthesized voices', [f'laugh-a-{c}' for c, _, _ in CAST]),
                  ('B', 'Toy chimes: each hero\'s own little instrument', [f'laugh-b-{c}' for c, _, _ in CAST])],
                 [L for _, L, _ in CAST])
laugh['colors'] = [col for _, _, col in CAST]
game('app', 'Across the app', 'Menus, buttons, sheets, tabs, popups, streaks, achievements, level-up, the intro and notices.', [
    row('intro', 'App intro (the cast parades in)', 'hop', 'Today: iOS plays a quick cascade of hops as the cast lands, Android one quiet hop, web nothing. '
        'The jingles are cut to the intro\'s beats: the W pops (0 s), one note per hero (0.6 to 1.3 s), the glide (1.7 s), "ta-da" on landing (2.2 s).',
        [('intro-a', 'A', 'Marimba Parade'), ('intro-b', 'B', 'Music Box'), ('intro-c', 'C', 'Glock & Boing')]),
    row('press', 'Pressing a squishy button', 'press'),
    row('release', 'Letting go of it', 'release'),
    row('tab', 'Switching tabs', None, 'Home, Leaderboard, Stats, Friends: silent today.',
        [('tab-a', 'A', 'Soft tick'), ('tab-b', 'B', 'Glass tick'), ('alt-tap-a', 'C', 'Felt tap')]),
    row('sheet', 'A popup or sheet opens', 'whoosh', 'Help, Go Pro, streak popups, onboarding, the finish popup.'),
    row('open', 'NEW: opening a game', None, 'Silent today.', [('open-a', 'A', 'Page Breeze'), ('open-b', 'B', 'Page Flutter')]),
    laugh,
    row('streak', 'Streak +1 / a shield saves your streak', 'streak'),
    row('sweep', 'Daily sweep, flawless, Pro welcome', 'celebrate'),
    row('achieve', 'Achievement unlocked', 'unlock', 'Android is silent here today.'),
    row('levelup', 'NEW: level up', 'unlock', 'iOS shows level-up in the achievement popup (plays unlock); web and Android are silent.',
        [('levelup-a', 'A', 'Toy Fanfare'), ('levelup-b', 'B', 'Rising Stairs')]),
    row('notice', 'In-app notice', 'notify', 'iOS only today.'),
    row('hop', 'Mascot hops (mascot builder, onboarding)', 'hop')],
    [['intro', 200], ['press', 3600], ['release', 3750], ['sheet', 3800], ['tab', 4700], ['press', 5300], ['release', 5450],
     ['open', 5500], ['achieve', 6400], ['levelup', 8000]])

# ── The page ────────────────────────────────────────────────────────────────
def choice(game_id, r, letter, key, name, now=False):
    pick_label = 'Keep' if now else 'Pick'
    dis = '' if key else ' disabled'
    data = f' data-snd="{key}"' if key else ''
    lbl = 'Now' if now else letter
    return (f'<div class="ch{" now" if now else ""}" data-opt="{"NOW" if now else letter}">'
            f'<button class="play"{data}{dis} aria-label="Play {E(r["event"])}: {E(lbl)} {E(name)}">'
            f'<span class="big">{E(lbl)}</span><span class="nm">{E(name)}</span></button>'
            f'<button class="pick" data-game="{game_id}" data-row="{r["id"]}" data-opt="{"NOW" if now else letter}" '
            f'data-name="{E(name)}" aria-pressed="false">{pick_label}</button></div>')

def render_row(g, r):
    head = (f'<div class="evhead"><h3>{E(r["event"])}</h3>' + (f'<p>{E(r["note"])}</p>' if r['note'] else '') + '</div>')
    now = choice(g['id'], r, 'NOW', r['cur'], r['curName'] if r['cur'] else 'silent today', now=True)
    if r.get('grid'):
        sets = ''
        for si, s in enumerate(r['sets']):
            hd, _, rest = s['n'].partition(': '); rest = rest[:1].upper() + rest[1:]
            cells = ''
            for i, k in enumerate(s['keys']):
                st = f' style="--c:{r["colors"][i]}"' if r.get('colors') else ''
                cells += f'<button class="play cell{" hero" if r.get("colors") else ""}" data-snd="{k}"{st} aria-label="Play {E(hd)} {E(r["labels"][i])}"><span>{E(r["labels"][i])}</span></button>'
            sets += (f'<div class="set"><div class="sethead"><span class="badge">{s["l"]}</span><div class="st"><b>{E(hd)}</b><span>{E(rest)}</span></div>'
                     f'<button class="pick" data-game="{g["id"]}" data-row="{r["id"]}" data-opt="{s["l"]}" data-name="{E(hd)}" aria-pressed="false">Pick</button></div>'
                     f'<div class="cells n{len(s["keys"])}">{cells}</div></div>')
        return f'<div class="ev" id="r-{g["id"]}-{r["id"]}">{head}<div class="choices one">{now}</div>{sets}</div>'
    opts = ''.join(choice(g['id'], r, o['l'], o['k'], o['n']) for o in r['opts'])
    return f'<div class="ev" id="r-{g["id"]}-{r["id"]}">{head}<div class="choices c{1 + len(r["opts"])}">{now}{opts}</div></div>'

body = ''
for gi, g in enumerate(GAMES):
    rows = ''.join(render_row(g, r) for r in g['rows'])
    body += (f'<details class="game" id="g-{g["id"]}"{" open" if gi == 0 else ""}><summary><span class="gt">{E(g["title"])}</span>'
             f'<span class="gb">{E(g["blurb"])}</span><span class="chev" aria-hidden="true"></span></summary>'
             f'<div class="seqbar"><button class="seq" data-game="{g["id"]}"><span class="ico"></span><span class="sl">Play sequence</span></button>'
             f'<div class="mode" role="group" aria-label="Which sounds"><button class="md on" data-game="{g["id"]}" data-mode="cur">Current</button>'
             f'<button class="md" data-game="{g["id"]}" data-mode="pick">My picks</button></div></div>'
             f'<div class="rows">{rows}</div></details>')

# What the page's JS needs: per game, its rows (current key, option keys by letter, grid sets) + the sequence.
JS_GAMES = {}
for g in GAMES:
    rows = {}
    for r in g['rows']:
        d = dict(event=r['event'], cur=r['cur'])
        if r.get('grid'): d['sets'] = {s['l']: s['keys'] for s in r['sets']}; d['names'] = {s['l']: s['n'].split(':')[0] for s in r['sets']}
        else: d['opts'] = {o['l']: o['k'] for o in r['opts']}; d['names'] = {o['l']: o['n'] for o in r['opts']}
        rows[r['id']] = d
    JS_GAMES[g['id']] = dict(title=g['title'], rows=rows, order=[r['id'] for r in g['rows']], seq=g['seq'])

nav = ''.join(f'<a href="#g-{g["id"]}">{E(g["title"])}</a>' for g in GAMES)
PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wordocious Sound Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--bg:#f7eefa;--bg2:#f1d7f6;--ink:#2b1640;--muted:#6f5a86;--tile:#ffffffd9;--tile2:#efe2f7;--now:#e9dcf5;--nowInk:#4c2a7a;
--brand:#7c3aed;--brand2:#c026d3;--on:#fff;--gold1:#fde68a;--gold2:#f59e0b;--goldInk:#3b2300;--sound:#fff3c4;
--shadow:0 5px 0 #5b21b6,0 8px 18px #7c3aed38;--shadowNow:0 5px 0 #c9b3e3;--shadowGold:0 5px 0 #b45309}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#160d22;--bg2:#24123a;--ink:#f4ecff;--muted:#b9a6d3;--tile:#2a1a40d9;--tile2:#2f1d47;--now:#3a2754;--nowInk:#e9dcff;--sound:#3d3110;--shadow:0 5px 0 #3b0f86,0 8px 18px #00000066;--shadowNow:0 5px 0 #24163a;--shadowGold:0 5px 0 #78350f}}
:root[data-theme="dark"]{--bg:#160d22;--bg2:#24123a;--ink:#f4ecff;--muted:#b9a6d3;--tile:#2a1a40d9;--tile2:#2f1d47;--now:#3a2754;--nowInk:#e9dcff;--sound:#3d3110;--shadow:0 5px 0 #3b0f86,0 8px 18px #00000066;--shadowNow:0 5px 0 #24163a;--shadowGold:0 5px 0 #78350f}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:64px}
body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,var(--bg2),var(--bg) 70%) fixed,var(--bg);color:var(--ink);font:600 16px/1.45 Nunito,ui-rounded,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.wrap{max-width:900px;margin:0 auto;padding:18px 16px 120px}
header{text-align:center;padding:10px 0 4px}
header h1{margin:0;font-weight:900;font-size:clamp(30px,7vw,46px);letter-spacing:-.5px;background:linear-gradient(90deg,var(--brand),var(--brand2));-webkit-background-clip:text;background-clip:text;color:transparent}
header p{margin:6px auto 0;max-width:600px;color:var(--muted)}
.how{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;margin:10px 0 0;color:var(--muted);font-size:14px}
.how b{color:var(--ink)}
nav{position:sticky;top:0;z-index:5;display:flex;gap:6px;overflow-x:auto;margin:10px -16px 4px;padding:10px 16px;background:linear-gradient(var(--bg) 72%,transparent);scrollbar-width:none}
nav::-webkit-scrollbar{display:none}
nav a{flex:none;text-decoration:none;color:var(--brand);background:var(--tile2);padding:8px 14px;border-radius:999px;font-weight:800;font-size:14px}
.game{margin:14px 0;background:var(--tile);border-radius:26px;padding:4px 14px 14px}
summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:0 10px;padding:12px 2px 8px}
summary::-webkit-details-marker{display:none}
.gt{font-weight:900;font-size:24px;grid-column:1}
.gb{grid-column:1;color:var(--muted);font-size:14px}
.chev{grid-column:2;grid-row:1/3;align-self:center;width:36px;height:36px;border-radius:12px;background:var(--tile2);position:relative}
.chev:after{content:"";position:absolute;left:12px;top:10px;width:10px;height:10px;border-right:3px solid var(--brand);border-bottom:3px solid var(--brand);transform:rotate(45deg);transition:transform .2s}
details[open] .chev:after{transform:translate(0,5px) rotate(-135deg)}
.seqbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 12px}
.seq{appearance:none;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:10px 20px;border-radius:999px;color:var(--on);
 font:900 17px/1 Nunito,ui-rounded,system-ui,sans-serif;background:linear-gradient(160deg,#f472b6,var(--brand2) 50%,var(--brand));box-shadow:var(--shadow);touch-action:manipulation}
.seq .ico{width:0;height:0;border-left:13px solid currentColor;border-top:8px solid transparent;border-bottom:8px solid transparent}
.seq.playing .ico{border:0;width:12px;height:12px;border-radius:3px;background:currentColor}
.mode{display:inline-flex;background:var(--tile2);border-radius:999px;padding:4px}
.md{appearance:none;border:0;cursor:pointer;min-height:44px;padding:8px 16px;border-radius:999px;background:transparent;color:var(--muted);font:800 15px Nunito,ui-rounded,system-ui,sans-serif}
.md.on{background:var(--brand);color:var(--on)}
.rows{display:grid;gap:10px}
.ev{background:var(--tile2);border-radius:20px;padding:12px;transition:background .15s}
.ev.sounding{background:var(--sound)}
.evhead h3{margin:0;font-size:16px;font-weight:900}
.evhead p{margin:2px 0 0;color:var(--muted);font-size:13.5px}
.choices{display:grid;gap:8px;margin-top:10px}
.choices.c4{grid-template-columns:1.15fr 1fr 1fr 1fr}.choices.c3{grid-template-columns:1.15fr 1fr 1fr}.choices.one{grid-template-columns:minmax(0,180px)}
.ch{display:flex;flex-direction:column;gap:6px;min-width:0}
.play{appearance:none;border:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:68px;padding:8px 4px;border-radius:18px;
 color:var(--on);font:900 15px/1.1 Nunito,ui-rounded,system-ui,sans-serif;background:linear-gradient(160deg,#9b5cf6,var(--brand) 55%,#6d28d9);box-shadow:var(--shadow);
 transition:transform .12s cubic-bezier(.3,1.4,.5,1),box-shadow .12s;touch-action:manipulation;user-select:none;-webkit-user-select:none;min-width:0}
.play .big{font-size:22px}.play .nm{font-size:12px;font-weight:800;opacity:.92;text-align:center;overflow-wrap:anywhere}
.now .play{background:var(--now);color:var(--nowInk);box-shadow:var(--shadowNow)}
.play:disabled{cursor:default;opacity:.55;box-shadow:none}
.play:not(:disabled):active{transform:translateY(4px) scale(.98);box-shadow:none}
.play:focus-visible,.pick:focus-visible,.seq:focus-visible,.md:focus-visible{outline:3px solid var(--brand2);outline-offset:3px}
.play.playing{background:linear-gradient(160deg,#f0abfc,var(--brand2));color:var(--on);animation:pulse .45s ease-in-out infinite alternate}
@keyframes pulse{to{transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){.play.playing{animation:none}}
.pick{appearance:none;border:0;cursor:pointer;min-height:38px;border-radius:12px;background:transparent;color:var(--muted);font:800 13px Nunito,ui-rounded,system-ui,sans-serif;touch-action:manipulation}
.pick[aria-pressed="true"]{background:linear-gradient(160deg,var(--gold1),var(--gold2));color:var(--goldInk);box-shadow:var(--shadowGold)}
.pick[aria-pressed="true"]:before{content:"\2605  "}
.ch.picked .play{box-shadow:var(--shadowGold),0 8px 18px #f59e0b55}
.set{margin-top:10px}
.sethead{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.sethead .st{flex:1;min-width:0}.sethead b{display:block;font-size:15px}.sethead .st span{display:block;color:var(--muted);font-size:13px}
.sethead .pick{padding:0 14px;background:var(--tile)}
.sethead .pick[aria-pressed="true"]{background:linear-gradient(160deg,var(--gold1),var(--gold2))}
.badge{flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font-weight:900;font-size:18px;color:var(--on);background:linear-gradient(135deg,var(--brand),var(--brand2))}
.cells{display:grid;gap:8px}.cells.n10,.cells.n5{grid-template-columns:repeat(5,1fr)}
.play.cell{min-height:56px;font-size:15px;border-radius:16px}
.play.hero{background:var(--c);box-shadow:0 5px 0 color-mix(in srgb,var(--c) 60%,#000);font-size:22px}
.dock{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;justify-content:center;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(transparent,var(--bg) 40%)}
.dock button{appearance:none;border:0;cursor:pointer;min-height:52px;padding:10px 22px;border-radius:999px;font:900 16px Nunito,ui-rounded,system-ui,sans-serif;touch-action:manipulation}
#copy{color:var(--goldInk);background:linear-gradient(160deg,var(--gold1),var(--gold2));box-shadow:var(--shadowGold)}
#count{color:var(--brand);background:var(--tile2)}
#out{display:none;width:100%;min-height:160px;margin-top:14px;padding:12px;border:0;border-radius:16px;background:var(--tile2);color:var(--ink);font:600 14px/1.4 ui-monospace,Menlo,monospace}
#out.show{display:block}
.toast{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:999px;font-weight:800;opacity:0;transition:opacity .2s;pointer-events:none;z-index:7}
.toast.show{opacity:1}
footer{color:var(--muted);font-size:13px;text-align:center;margin-top:28px}
@media (max-width:560px){
 .game{padding:2px 10px 12px;border-radius:22px}
 .ev{padding:10px}
 .choices{gap:6px}
 .play{min-height:64px;border-radius:16px}
 .play .big{font-size:20px}.play .nm{font-size:11px}
 .cells{gap:6px}
 .seq{flex:1;justify-content:center}
 .mode{flex:1}.md{flex:1}
}
</style></head><body><div class="wrap">
<header><h1>Sound Lab</h1>
<p>Every sound in every game. The left tile is what plays <b>now</b>; A, B and C are options for that same moment.</p>
<div class="how"><span><b>Tap a tile</b> to listen</span><span><b>Pick</b> marks your choice</span><span><b>Play sequence</b> hears a whole moment</span><span><b>Copy my picks</b> and paste them to Claude</span></div>
</header>
<nav>__NAV__</nav>
__BODY__
<textarea id="out" readonly aria-label="My picks as text"></textarea>
<footer>Synthesized in code: docs/design/brand/sounds/make-sound-options.py + build-lab.py. Nothing here ships until picked.</footer>
</div>
<div class="dock"><button id="count" type="button">0 picks</button><button id="copy" type="button">Copy my picks</button></div>
<div class="toast" id="toast" role="status"></div>
<script>
const B64 = __AUDIO__;
const GAMES = __GAMES__;
const KEY = 'wordocious-soundlab-picks-v2';
// ── Single plays: one <audio> per clip, one at a time ──
const els = {};
for (const [k, b] of Object.entries(B64)) { const a = new Audio(); a.preload = 'auto'; a.src = 'data:audio/mp4;base64,' + b; els[k] = a; }
window.__labAudio = els;
let cur = null, curBtn = null;
function stopSingle() {
  if (cur) { try { cur.pause(); cur.currentTime = 0; } catch (e) {} }
  if (curBtn) curBtn.classList.remove('playing');
  cur = null; curBtn = null;
}
function playSingle(k, btn) {
  const a = els[k]; if (!a) return;
  const same = cur === a; stopAll(); if (same) return;
  cur = a; curBtn = btn; btn && btn.classList.add('playing');
  a.onended = () => { if (cur === a) stopSingle(); };
  const p = a.play(); if (p && p.catch) p.catch(() => stopSingle());
}
// ── Sequences: Web Audio, so taps / flips can overlap and land on time ──
let ctx = null; const bufs = {}; let seqRun = null;
function getCtx() { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; ctx = new C(); } if (ctx.state !== 'running') ctx.resume(); return ctx; }
function b64bytes(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function decode(k) {
  if (bufs[k]) return bufs[k];
  const c = getCtx();
  bufs[k] = new Promise((res, rej) => { const p = c.decodeAudioData(b64bytes(B64[k]), res, rej); if (p && p.then) p.then(res, rej); });
  return bufs[k];
}
function stopSeq() {
  if (!seqRun) return;
  seqRun.srcs.forEach((s) => { try { s.stop(); } catch (e) {} });
  seqRun.timers.forEach(clearTimeout);
  seqRun.btn.classList.remove('playing'); seqRun.btn.querySelector('.sl').textContent = 'Play sequence';
  document.querySelectorAll('.ev.sounding').forEach((e) => e.classList.remove('sounding'));
  seqRun = null;
}
function stopAll() { stopSingle(); stopSeq(); }
const modes = {};
function clipFor(gid, rid, sub, mode) {
  const r = GAMES[gid].rows[rid]; if (!r) return null;
  if (mode === 'pick') {
    const p = (picks[gid] || {})[rid];
    if (p && p !== 'NOW') { if (r.sets) { const s = r.sets[p]; return s ? s[Math.min(sub || 0, s.length - 1)] : r.cur; } return r.opts[p] || r.cur; }
  }
  return r.cur;   // null = silent today
}
async function playSeq(gid, btn) {
  const was = seqRun && seqRun.gid === gid; stopAll(); if (was) return;
  const mode = modes[gid] || 'cur', g = GAMES[gid];
  const steps = g.seq.map(([rid, ms, sub]) => ({ rid, ms, k: clipFor(gid, rid, sub, mode) }));
  const run = seqRun = { gid, btn, srcs: [], timers: [], played: 0, silent: 0, mode };
  btn.classList.add('playing'); btn.querySelector('.sl').textContent = 'Stop';
  const c = getCtx();
  const keys = [...new Set(steps.map((s) => s.k).filter(Boolean))];
  let decoded;
  try { decoded = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await decode(k)]))); } catch (e) { stopSeq(); return; }
  if (seqRun !== run) return;
  if (!run.played) toast(mode === 'pick' ? 'Nothing picked here yet.' : 'Silent today. Pick options, then try My picks.');
  const t0 = c.currentTime + 0.08; let end = 0;
  for (const s of steps) {
    const row = document.getElementById('r-' + gid + '-' + s.rid);
    run.timers.push(setTimeout(() => { if (!row) return; row.classList.add('sounding'); setTimeout(() => row.classList.remove('sounding'), 260); }, s.ms + 80));
    if (!s.k) { run.silent++; continue; }
    const src = c.createBufferSource(); src.buffer = decoded[s.k];
    const gain = c.createGain(); gain.gain.value = 0.85; src.connect(gain); gain.connect(c.destination);
    src.start(t0 + s.ms / 1000); run.srcs.push(src); run.played++;
    end = Math.max(end, s.ms / 1000 + decoded[s.k].duration);
  }
  run.timers.push(setTimeout(() => {
    if (seqRun === run) { const d = { gid, mode, played: run.played, silent: run.silent }; stopSeq(); window.dispatchEvent(new CustomEvent('lab:seqdone', { detail: d })); }
  }, end * 1000 + 250));
  window.dispatchEvent(new CustomEvent('lab:seqstart', { detail: { gid, mode, scheduled: run.played, silent: run.silent } }));
}
// ── Picks ──
let picks = {};
try { picks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { picks = {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) {} }
function paint() {
  let n = 0;
  document.querySelectorAll('.pick').forEach((b) => {
    const on = (picks[b.dataset.game] || {})[b.dataset.row] === b.dataset.opt;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? 'Mine' : (b.dataset.opt === 'NOW' ? 'Keep' : 'Pick');
    const ch = b.closest('.ch'); if (ch) ch.classList.toggle('picked', on);
  });
  for (const g of Object.values(picks)) n += Object.keys(g).length;
  document.getElementById('count').textContent = n + (n === 1 ? ' pick' : ' picks');
}
function summary() {
  const lines = ['Wordocious Sound Lab picks'];
  for (const [gid, g] of Object.entries(GAMES)) {
    const p = picks[gid]; if (!p) continue;
    const rows = g.order.filter((rid) => p[rid]);
    if (!rows.length) continue;
    lines.push('', g.title);
    for (const rid of rows) {
      const r = g.rows[rid], o = p[rid];
      lines.push('  ' + r.event + ' → ' + (o === 'NOW' ? 'keep current' + (r.cur ? '' : ' (silent)') : o + ' ' + (r.names[o] || '') + ' (' + (r.opts ? r.opts[o] : (r.sets[o] || [''])[0].replace(/-[^-]+$/, '')) + ')'));
    }
  }
  if (lines.length === 1) lines.push('', '(no picks yet)');
  return lines.join('\n');
}
window.__labSummary = summary;
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }
async function copyPicks() {
  const text = summary(), out = document.getElementById('out');
  out.value = text; out.classList.add('show');
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it to Claude.'); return; } catch (e) {}
  out.focus(); out.select(); out.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  toast(ok ? 'Copied. Paste it to Claude.' : 'Selected below: copy it from there.');
  out.scrollIntoView({ block: 'center' });
}
// ── Wiring ──
document.addEventListener('click', (e) => {
  const pb = e.target.closest('button.play');
  if (pb && pb.dataset.snd) { playSingle(pb.dataset.snd, pb); return; }
  const pk = e.target.closest('button.pick');
  if (pk) {
    const g = picks[pk.dataset.game] = picks[pk.dataset.game] || {};
    if (g[pk.dataset.row] === pk.dataset.opt) delete g[pk.dataset.row]; else g[pk.dataset.row] = pk.dataset.opt;
    if (!Object.keys(g).length) delete picks[pk.dataset.game];
    save(); paint(); return;
  }
  const sq = e.target.closest('button.seq'); if (sq) { playSeq(sq.dataset.game, sq); return; }
  const md = e.target.closest('button.md');
  if (md) {
    modes[md.dataset.game] = md.dataset.mode;
    md.parentElement.querySelectorAll('.md').forEach((b) => b.classList.toggle('on', b === md));
    if (seqRun && seqRun.gid === md.dataset.game) stopSeq();
    return;
  }
  if (e.target.id === 'copy') { copyPicks(); return; }
  if (e.target.id === 'count') { const out = document.getElementById('out'); out.value = summary(); out.classList.add('show'); out.scrollIntoView({ block: 'center' }); return; }
  const a = e.target.closest('nav a');
  if (a) { const d = document.querySelector(a.getAttribute('href')); if (d && d.tagName === 'DETAILS') d.open = true; }
});
paint();
</script></body></html>"""
out = (PAGE.replace('__NAV__', nav).replace('__BODY__', body)
       .replace('__AUDIO__', json.dumps(AUDIO)).replace('__GAMES__', json.dumps(JS_GAMES, ensure_ascii=False)))
with open(os.path.join(HERE, 'lab.html'), 'w') as f: f.write(out)
n_rows = sum(len(g['rows']) for g in GAMES)
print(f'lab.html {len(out) / 1e6:.2f} MB · {len(GAMES)} sections · {n_rows} event rows · {len(AUDIO)} clips')
missing = [k for k in os.listdir(OPT) if k.endswith('.m4a') and k[:-4] not in AUDIO]
print('options not on the page:', missing)
