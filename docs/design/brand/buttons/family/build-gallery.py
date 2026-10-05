#!/usr/bin/env python3
"""options.html — the button family options gallery (self-contained: WebP data URIs + the Brand font).
Every piece is drawn the way the apps draw it: a plain fill + the ChatGPT light map (CSS border-image
three-slice / nine-slice), icons tinted by multiply. python3 build-gallery.py"""
import base64, io, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
OUT = os.path.join(HERE, 'out')
ART = os.path.join(REPO, 'apps', 'web', 'public', 'art')


def uri(path, q=90, max_h=None):
    im = Image.open(path).convert('RGBA')
    if max_h and im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def font():
    p = os.path.join(REPO, 'apps', 'web', 'app', 'fonts', 'Nunito-Black.woff')
    return 'data:font/woff;base64,' + base64.b64encode(open(p, 'rb').read()).decode()


LM = {k: uri(os.path.join(OUT, f'fam-lm-{k}.png'), 92) for k in ['frost', 'frost-pressed', 'pearl', 'pearl-pressed', 'key', 'keyfrost']}
IC = {k: uri(os.path.join(OUT, f'fam-ic-{k}.png'), 90, 96) for k in
      ['delete', 'shuffle', 'enter', 'hint', 'eye', 'flag', 'check', 'undo', 'next', 'refresh', 'sparkles', 'pencil', 'erase', 'xmark', 'play', 'chart']}
CIC = {k: uri(os.path.join(OUT, f'fam-cic-{k}.png'), 90, 96) for k in ['close', 'info', 'back', 'gem', 'gem-gold', 'star']}
A = lambda n, h=None: uri(os.path.join(ART, n + '.webp'), 90, h)
TOG = {k: A(f'art-toggle-light-{k}') for k in ['track', 'thumb-on', 'thumb-off', 'switch', 'switch-on', 'knob']}
TOGD = {k: A(f'art-toggle-dark-{k}') for k in ['track', 'thumb-on', 'switch', 'switch-on', 'knob']}
SKIN = {c: A(f'art-btn-{c}-m') for c in ['purple', 'gold', 'blue', 'slate', 'pink', 'teal', 'green']}
LAB = {s: A(f'art-btnlabel-{s}', 60) for s in ['rematch', 'accept', 'decline', 'challengethem', 'playagain', 'continue', 'notnow']}
GAME = {g: A(f'game-{g}', 96) for g in ['hub', 'crossword', 'propernoundle', 'ladder', 'gauntlet']}
HDR = {k: A(f'icon3d-{k}', 96) for k in ['share', 'back', 'sound']}
for k in ['gear', 'trophy', 'help']:
    HDR[k] = uri(os.path.join(REPO, 'docs', 'design', 'brand', 'icons', f'{k}.png'), 90, 96)

TS = [Image.open(os.path.join(ART, f'art-toggle-light-{k}.webp')).height // 2 for k in ['track', 'thumb-on']]
GAMES = {  # mode accent (ModeCatalog) → the helper wash / ink
    'hub': '#c026d3', 'crossword': '#475569', 'propernoundle': '#dc2626', 'ladder': '#0284c7', 'gauntlet': '#d97706',
    'sudoku': '#1e40af', 'regions': '#ca8a04', 'cryptogram': '#92400e', 'groups': '#9f1239', 'scramble': '#f97316', 'wordsearch': '#4d7c0f',
}


def helper(label, icon, game, opt='a', state=''):
    acc = GAMES[game]
    ic = f'<i class="fic" style="--ic:url({IC[icon]})"></i>' if icon else ''
    return f'<button class="fh fh-{opt} {state}" style="--acc:{acc}">{ic}<span>{label}</span></button>'


def old(label, variant='purple', small=True, sym=''):
    return f'<button class="old old-{variant}{" old-s" if small else ""}">{sym}<span>{label}</span></button>'


def quiet(label, opt='a'):
    return f'<button class="fq fq-{opt}">{label}</button>'


def cast(color, slug, live=None):
    lab = f'<img class="cl" src="{LAB[slug]}" alt="">' if slug else f'<span class="clive">{live}</span>'
    return f'<button class="cast" style="--skin:url({SKIN[color]})">{lab}</button>'


def roundb(kind, opt='a'):
    src = CIC.get(kind) or HDR.get(kind)
    return f'<button class="fr fr-{opt}" aria-label="{kind}"><img src="{src}" alt=""></button>'


def keyrow(letters, opt='a', states=None):
    states = states or {}
    return ''.join(f'<span class="fk fk-{opt} {states.get(ch, "")}">{ch}</span>' for ch in letters)


def keyboard(opt='a'):
    st = {'W': 'k-c', 'O': 'k-c', 'R': 'k-p', 'D': 'k-a', 'S': 'k-a', 'A': 'k-p', 'E': 'k-a', 'T': 'k-a'}
    return f'''<div class="kb">
  <div class="kr">{keyrow("QWERTYUIOP", opt, st)}</div>
  <div class="kr kr2">{keyrow("ASDFGHJKL", opt, st)}</div>
  <div class="kr"><span class="fk fk-{opt} wide">ENTER</span>{keyrow("ZXCVBNM", opt, st)}<span class="fk fk-{opt} wide"><i class="fic del" style="--ic:url({IC['delete']})"></i></span></div>
</div>'''


def hex_board():
    letters = ['U', 'D', 'E', 'L', 'M', 'N', 'P']
    pos = [(0, -1), (-0.87, -0.5), (0.87, -0.5), (0, 0), (-0.87, 0.5), (0.87, 0.5), (0, 1)]
    cells = ''.join(f'<span class="hx{" hc" if i == 3 else ""}" style="left:calc(50% + {x * 58}px - 27px);top:{86 + y * 58 - 27}px">{l}</span>'
                    for i, ((x, y), l) in enumerate(zip(pos, letters)))
    return f'<div class="hexes">{cells}</div>'


def chips():
    return '''<div class="chips">
  <span class="chip">DUDE</span><span class="chip">MULE</span><span class="chip pg">UNDEMPL ★</span>
  <span class="chip rare">PLUMED<i class="gem" style="--g:url(%s)"></i></span><span class="chip">LEND</span>
</div>''' % CIC['gem']


def phone(title, game, body, dark=False):
    return f'''<div class="phone{" dk" if dark else ""}"><div class="ph-top"><img src="{HDR['back']}" alt=""><b>{title}</b><img src="{HDR['help']}" alt=""></div>
<div class="ph-game"><img src="{GAME[game]}" alt=""></div>{body}</div>'''


def hub_mock(opt):
    if opt == 'old':
        rows = (old('Delete', 'pink'), old('Shuffle', 'pink'), old('Enter', 'purple')), (old('Starts with…', 'amber'), old('Reveal a word', 'peach'), old('End puzzle', 'peach'))
    else:
        rows = (helper('Delete', 'delete', 'hub', opt), helper('Shuffle', 'shuffle', 'hub', opt), helper('Enter', 'enter', 'hub', opt)), \
               (helper('Starts with…', 'hint', 'hub', opt), helper('Reveal a word', 'eye', 'hub', opt, 'used'), helper('End puzzle', 'flag', 'hub', opt))
    body = f'<div class="word">PLUM<span class="caret"></span></div>{hex_board()}' + ''.join(f'<div class="hrow">{"".join(r)}</div>' for r in rows) + chips()
    return phone('Hubbub', 'hub', body)


def xw_mock(opt):
    grid = ''.join(f'<span class="xc{" xb" if i in (4, 10, 20, 24) else ""}{" xs" if i in (6, 7, 8) else ""}">{"CAT"[i - 6] if i in (6, 7, 8) else ""}</span>' for i in range(25))
    if opt == 'old':
        row = old('Check', 'teal') + old('Letter', 'purple') + old('Word', 'purple') + old('Reveal all', 'peach')
    else:
        row = helper('Check', 'check', 'crossword', opt) + helper('Letter', 'sparkles', 'crossword', opt) + helper('Word', 'eye', 'crossword', opt) + helper('Reveal all', 'flag', 'crossword', opt)
    return phone('Crosswordocious', 'crossword', f'<div class="xgrid">{grid}</div><div class="clue">1A · Purring pet (3)</div><div class="hrow">{row}</div>')


def misc_rows(opt):
    def g(*items):
        return '<div class="hrow">' + ''.join(items) + '</div>'
    if opt == 'old':
        return g(old('Clue', 'amber'), old('Vowel', 'purple'), old('Consonant', 'purple')) + g(old('Undo', 'peach'), old('Hint', 'amber')) + g(old('Finish', 'peach'), old('See results', 'purple'))
    return (g(helper('Clue', 'hint', 'propernoundle', opt), helper('Vowel', 'sparkles', 'propernoundle', opt), helper('Consonant', 'play', 'propernoundle', opt))
            + g(helper('Undo', 'undo', 'ladder', opt), helper('Hint', 'hint', 'ladder', opt, 'pressed'))
            + g(helper('Notes', 'pencil', 'sudoku', opt), helper('Erase', 'erase', 'sudoku', opt), helper('Shuffle', 'shuffle', 'groups', opt), helper('Mark', 'xmark', 'regions', opt))
            + g(helper('Finish', 'flag', 'gauntlet', opt), helper('See results', 'chart', 'gauntlet', opt)))


def sheet_mock(opt):
    x = {'a': roundb('close', 'a'), 'b': roundb('close', 'b'), 'c': roundb('close', 'c'), 'old': '<button class="old old-peach old-s oldc">✕</button>'}[opt]
    q = {'a': quiet('Not now', 'a'), 'b': quiet('Not now', 'b'), 'c': quiet('Not now', 'c'), 'old': old('Not now', 'peach', False)}[opt]
    return f'''<div class="sheet"><div class="sh-x">{x}</div><div class="sh-t">Out of hints</div>
<div class="sh-d">Go Pro for unlimited hints in every game.</div>{cast('gold', None, 'Go Pro')}<div class="sp8"></div>{q}</div>'''


def settings_mock(opt, dark=False):
    T = TOGD if dark else TOG
    rows = [('Sound effects', 'Taps, flips and wins', True), ('Haptics', 'A soft buzz on taps', True), ('Colorblind tiles', 'Orange + blue', False)]
    def sw(on):
        if opt == 'old':
            return f'<span class="ios-sw{" on" if on else ""}"><i></i></span>'
        return f'<span class="csw{" on" if on else ""}" style="--off:url({T["switch"]});--on:url({T["switch-on"]})"><i style="background-image:url({T["knob"]})"></i></span>'
    r = ''.join(f'<div class="srow"><div><b>{a}</b><small>{b}</small></div>{sw(on)}</div>' for a, b, on in rows)
    seg = segmented(opt, T, 'Everyone', 'Friends')
    seg2 = segmented(opt, T, 'Daily', 'Unlimited')
    return f'<div class="setcard{" dk" if dark else ""}">{seg}<div class="sp8"></div>{seg2}<div class="sp8"></div>{r}<div class="sp8"></div>{quiet("Sign out", "a") if opt != "old" else old("Sign out", "peach", False)}</div>'


def segmented(opt, T, a, b):
    if opt == 'old':
        return f'<div class="oseg"><span class="on">{a}</span><span>{b}</span></div>'
    thumb = T['thumb-on'] if opt == 'a' else T['knob']
    return f'<div class="cseg cseg-{opt}" style="--tr:url({T["track"]});--th:url({T["thumb-on"]});--trs:{TS[0]};--ths:{TS[1]}"><span class="on">{a}</span><span>{b}</span></div>'


def vs_mock():
    return f'''<div class="vs"><div class="vs-h">VS lobby</div>
<div class="vs-card"><b>Webster</b><small>Boss bot · 10th rung</small><div class="hrow">{cast('blue', 'challengethem')}</div></div>
<div class="vs-card"><b>Ollie challenged you</b><small>Classic · 3 min</small><div class="hrow">{cast('green', 'accept')}{quiet('Decline', 'a')}</div></div>
<div class="vs-card"><b>You won 3–1</b><small>vs Ivy</small><div class="hrow">{cast('blue', 'rematch')}{quiet('See all', 'a')}</div></div>
<div class="vs-card"><b>Quick match</b><small>Anyone online now</small><div class="hrow">{cast('blue', None, 'Find match')}</div></div>
<div class="vs-card"><b>Pocket games</b><small>Rock paper scissors · Tic tac toe</small><div class="hrow">{helper('Heads', None, 'ladder', 'a')}{helper('Tails', None, 'ladder', 'a')}{helper('Rematch', 'refresh', 'ladder', 'a')}</div></div>
</div>'''


def option(name, tag, desc, html, rec=False):
    return f'''<div class="opt{" rec" if rec else ""}"><div class="opt-h"><b>{name}</b>{'<span class="tag">Recommended</span>' if rec else ''}{f'<span class="tag old-t">{tag}</span>' if tag else ''}</div>
<p>{desc}</p><div class="opt-b">{html}</div></div>'''


def states_strip(opt):
    return f'''<div class="states"><div>{helper('Shuffle', 'shuffle', 'hub', opt)}<small>normal</small></div>
<div>{helper('Shuffle', 'shuffle', 'hub', opt, 'pressed')}<small>pressed</small></div>
<div>{helper('Shuffle', 'shuffle', 'hub', opt, 'used')}<small>used</small></div>
<div class="dkbox">{helper('Shuffle', 'shuffle', 'hub', opt)}<small>dark</small></div></div>'''


def tint_strip(opt):
    items = [('Delete', 'delete', 'hub'), ('Check', 'check', 'crossword'), ('Clue', 'hint', 'propernoundle'), ('Undo', 'undo', 'ladder'),
             ('Finish', 'flag', 'gauntlet'), ('Notes', 'pencil', 'sudoku'), ('Mark', 'xmark', 'regions'), ('Hint', 'hint', 'cryptogram'),
             ('Shuffle', 'shuffle', 'groups'), ('Enter', 'enter', 'scramble'), ('Hint', 'hint', 'wordsearch')]
    return '<div class="tints">' + ''.join(helper(a, b, c, opt) for a, b, c in items) + '</div>'


CSS = open(os.path.join(HERE, 'gallery.css')).read()


def main():
    fam = []
    fam.append(('1 · Game helper buttons', 'The small pill under every board: a soft 3D white-clay icon + the label, tinted per game. '
                'Quieter than the cast buttons so the board stays the star. Every option is one fill + one ChatGPT light map, '
                'so every game color, the pressed / used states and dark mode come from the same two sprites.', [
        option('A · Frosted wash', '', 'A pale wash of the game color in the frosted jelly finish; icon + label in the deep game color. '
               'Reads as part of the game, never competes with PLAY AGAIN.',
               states_strip('a') + tint_strip('a'), True),
        option('B · Pearl chip', '', 'A neutral pearl pill; only the icon and label carry the game color. The quietest.', states_strip('b') + tint_strip('b')),
        option('C · Mini jelly', '', 'The full game color with a white icon + label. Loudest; close to the cast buttons.', states_strip('c') + tint_strip('c')),
        option('Today · candy', 'current', 'Gradient + gold ring + hard lip, white outlined text.', '<div class="tints">' + old('Delete', 'pink') + old('Shuffle', 'pink') + old('Hint', 'amber') + old('Reveal all', 'peach') + '</div>'),
    ], '<div class="ctx">' + ''.join(f'<div><small>{n}</small>{hub_mock(o)}</div>' for n, o in [('A (recommended)', 'a'), ('B', 'b'), ('C', 'c'), ('Today', 'old')]) + '</div>'
       + '<div class="ctx">' + ''.join(f'<div><small>{n}</small>{xw_mock(o)}</div>' for n, o in [('A (recommended)', 'a'), ('B', 'b'), ('C', 'c'), ('Today', 'old')]) + '</div>'
       + '<div class="ctx">' + ''.join(f'<div class="rows"><small>{n}: ProperNoundle · Ladder · Sudocious / Kindred / Starsweep · Gauntlet</small>{misc_rows(o)}</div>' for n, o in [('A (recommended)', 'a'), ('B', 'b'), ('C', 'c'), ('Today', 'old')]) + '</div>'))
    fam.append(('2 · Secondary / quiet', 'Not now, Close, Skip, Cancel, How to play, Sign out, See all, Past words, Gift a friend, Restore purchases. '
                'Always next to (or under) a cast button, never louder than it. Text links (Forgot password?) stay text links.', [
        option('A · Lavender ghost pill', '', 'The frosted pill in a soft lavender, deep-purple Nunito Black. Clearly a button, clearly second.',
               '<div class="tints">' + ''.join(quiet(t, 'a') for t in ['Not now', 'Skip', 'How to play', 'Sign out', 'See all', 'Restore purchases']) + '</div>', True),
        option('B · Pearl pill', '', 'White pearl pill, purple label. Stands out more on lilac pages.',
               '<div class="tints">' + ''.join(quiet(t, 'b') for t in ['Not now', 'Skip', 'How to play', 'Sign out', 'See all', 'Restore purchases']) + '</div>'),
        option('C · Text only', '', 'Deep-purple Nunito Black, no pill, no chevron. Lightest, but loses the tap shape.',
               '<div class="tints">' + ''.join(quiet(t, 'c') for t in ['Not now', 'Skip', 'How to play', 'Sign out', 'See all', 'Restore purchases']) + '</div>'),
        option('Today · peach candy', 'current', '', '<div class="tints">' + old('Not now', 'peach', False) + old('Skip', 'peach', False) + '</div>'),
    ], '<div class="ctx">' + ''.join(f'<div><small>{n}</small>{sheet_mock(o)}</div>' for n, o in [('A (recommended)', 'a'), ('B', 'b'), ('C', 'c'), ('Today', 'old')]) + '</div>'))
    fam.append(('3 · Round icon buttons', 'Close X, share, leaderboard, info, settings, back. The founder rejected bubbles behind the header icons, so A keeps the icons bare.', [
        option('A · Bare soft 3D icon', '', 'The ChatGPT icon alone (28 pt in a 44 pt hit area), squish on press. Matches the header family exactly.',
               '<div class="tints">' + ''.join(roundb(k, 'a') for k in ['close', 'share', 'trophy', 'info', 'gear', 'back']) + '</div>', True),
        option('B · Frosted disc', '', 'The icon on a small frosted lavender disc (the helper finish).',
               '<div class="tints">' + ''.join(roundb(k, 'b') for k in ['close', 'share', 'trophy', 'info', 'gear', 'back']) + '</div>'),
        option('C · Pearl disc', '', 'The icon on a pearl disc. Most "button-like"; heaviest.',
               '<div class="tints">' + ''.join(roundb(k, 'c') for k in ['close', 'share', 'trophy', 'info', 'gear', 'back']) + '</div>'),
    ], ''))
    fam.append(('4 · Switches', 'On/off toggles and the two-way segmented switches (Everyone | Friends, Daily | Unlimited). '
                'The candy toggle sprites from the 10-03 night art are already this language, so A keeps them and finishes the rollout '
                '(three screens still use the system switch).', [
        option('A · Candy (keep + finish)', '', 'Frosted track that turns jelly purple, pearl knob; segmented: a glossy purple thumb slides under the choice.', settings_mock('a'), True),
        option('B · Pearl thumb', '', 'Same tracks, a pearl thumb with purple ink (quieter segmented).', settings_mock('b')),
        option('Today · system', 'current', 'The plain iOS switch / soft segmented still used in Edit Profile, Notifications, Profile, Leaderboard.', settings_mock('old')),
        option('A · dark', '', '', settings_mock('a', True), True),
    ], ''))
    fam.append(('5 · Keyboard keys', 'Letter, ENTER and delete keys; tile states purple (right spot) · gold (wrong spot) · slate (not in word), per the approved game kit. '
                'Each key = its state color + the ChatGPT key light map (nine-slice), so colorblind palettes keep working.', [
        option('A · Glossy keys', '', 'Pearl keys with the soft top gloss and rounded lip.',
               '<div class="kbs">' + keyboard('a') + '<div class="dkbox">' + keyboard('a') + '</div></div>', True),
        option('B · Frosted keys', '', 'Flatter frosted keys: a whisper of sheen.', '<div class="kbs">' + keyboard('b') + '<div class="dkbox">' + keyboard('b') + '</div></div>'),
        option('Today', 'current', '', '<div class="kbs">' + keyboard('old') + '<div class="dkbox">' + keyboard('old') + '</div></div>'),
    ], ''))
    fam.append(('6 · VS + pocket games', 'Mapped onto the families: Challenge / Rematch / Accept / Find match = cast buttons (VS blue, Accept green, art labels where they exist); '
                'Decline / See all = quiet A; pocket-game moves (Heads, Tails, Rock…) = helper A tinted per pocket game.', [
        option('Mapping', '', '', vs_mock(), True)], ''))
    fam.append(('Hubbub · rare words', 'The muted "BONUS" text tag is gone (no "bonus" on player screens since 09-25). A rarer word now wears a tiny glossy aqua gem on its chip corner; '
                'the pangram keeps its gold star. VoiceOver: "PLUMED, rare word".', [
        option('A · Corner gem', '', '', chips(), True)], ''))

    sec = ''.join(f'<section><h2>{t}</h2><p class="lead">{d}</p><div class="opts">{"".join(o)}</div>{ctx}</section>' for t, d, o, ctx in fam)
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Button Family</title><style>@font-face{{font-family:Brand;src:url({font()}) format("woff");font-weight:900}}
:root{{--lm-frost:url({LM['frost']});--lm-frost-p:url({LM['frost-pressed']});--lm-pearl:url({LM['pearl']});--lm-pearl-p:url({LM['pearl-pressed']});--lm-key:url({LM['key']});--lm-keyfrost:url({LM['keyfrost']})}}
{CSS}</style></head><body>
<header><h1>Button family</h1><p>Everything that is not a primary cast button, designed in ChatGPT (free) on 10-05: the frosted + pearl pill finishes, key caps, white-clay helper icons and color icons in
<code>raw/</code>. Each family has 2–3 options, the current candy style next to them, and the pick tagged <span class="tag">Recommended</span>. Tap any button to see its pressed state.</p></header>
{sec}<footer>Sources: docs/design/brand/buttons/family (make-family.py → out/, build-gallery.py → options.html).</footer></body></html>'''
    open(os.path.join(HERE, 'options.html'), 'w').write(html)
    print('options.html', round(len(html) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
