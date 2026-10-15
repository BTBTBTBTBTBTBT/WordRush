# Builds jobs.json (the editor's input) from the raw simulator recordings' sidecar files (`<clip>.mp4.ss` = seconds into
# the clip where the scripted scene starts, `<clip>.mp4.len` = seconds of scripted play), the DB post titles
# (apps/web/lib/admin/jp45-posts.json) and the caption copy below. Then run make-video.py.
#   RAW=<raw folder> python3 build-jobs.py
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get('RAW', os.path.join(HERE, 'raw'))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..', '..'))
POSTS = json.load(open(os.path.join(REPO, 'apps', 'web', 'lib', 'admin', 'jp45-posts.json')))
POSTS = POSTS if isinstance(POSTS, list) else POSTS.get('posts', [])
TITLES = {p['date']: p['title'] for p in POSTS if p['title'].startswith('[Needs capture]')}
TAIL = 3.4            # seconds of finished screen kept after the scripted play


def side(n, ext):
    try:
        return float(open(os.path.join(RAW, f'{n}.mp4.{ext}')).read())
    except Exception:
        return None


def game_job(date, slug, clip, season, cap1, cap2, notes, tail=TAIL, maxlen=54):
    ss, ln = side(clip, 'ss'), side(clip, 'len')
    if ss is None or ln is None:
        return None
    start = max(0, ss - 0.25)
    t = min(maxlen, ln + 0.25 + tail)
    mid = round(t * 0.5, 1)
    return dict(date=date, slug=slug, post_title=TITLES[date], season=season, notes=notes, cover_at=round(min(t * 0.55, t - 1), 1),
                captions=[[cap1, 0.4, mid], [cap2, mid + 0.1, round(t - 0.2, 1)]],
                clips=[dict(file=f'{clip}.mp4', ss=round(start, 2), t=round(t, 2))])


def build():
    jobs = []
    H, S = 'halloween', 'standard'
    ep = [
        ('2026-10-20', 'ep01-octoword', 'octo', H, 'OctoWord: eight boards, one keyboard.', 'Every guess lands on all eight. Watch the cascade.'),
        ('2026-10-22', 'ep02-starsweep', 'starsweep', H, 'Starsweep: one star per row, column and color.', 'Tap wrong and it tells you.'),
        ('2026-10-23', 'ep03-muddle', 'muddle', H, 'Muddle: unscramble four words.', 'Then crack the punchline.'),
        ('2026-10-29', 'ep04-hubbub', 'hubbub', H, 'Hubbub: build words from seven letters.', 'Find the pangram that uses them all.'),
        ('2026-11-03', 'ep05-kindred', 'kindred', S, 'Kindred: sort sixteen words into four groups.', 'Watch for the near misses.'),
        ('2026-11-05', 'ep06-letter-ladder', 'ladder', S, 'Letter Ladder: change one letter at a time.', 'Climb from the first word to the last.'),
        ('2026-11-06', 'ep07-spyglass', 'spyglass', S, 'Spyglass: find the hidden words in the grid.', 'Ten words. Any direction.'),
        ('2026-11-10', 'ep08-codebreaker', 'code', S, 'Codebreaker: every letter is in code.', 'Crack the whole quote.'),
        ('2026-11-12', 'ep09-sudocious', 'sudocious', S, 'Sudocious: every row, column and box.', 'Digits one to nine. No repeats.'),
        ('2026-11-13', 'ep10-crosswordocious', 'crossword', S, 'Crosswordocious: a mini crossword, every day.', 'Tap a clue. Fill it in.'),
        ('2026-11-17', 'ep11-quadword', 'quad', S, 'QuadWord: four boards, one keyboard.', 'Every guess lands on all four.'),
        ('2026-11-20', 'ep12-succession', 'succession', S, 'Succession: four boards, one at a time.', 'Solve one to open the next.'),
        ('2026-11-24', 'ep13-deliverance', 'deliverance', S, 'Deliverance: four boards, clues already in.', 'Six guesses to deliver every word.'),
        ('2026-11-27', 'ep14-gauntlet', 'gauntlet', S, 'Gauntlet: five stages, one run.', 'Classic to OctoWord. Do not slip.'),
    ]
    for date, slug, clip, season, c1, c2 in ep:
        j = game_job(date, slug, clip, season, c1, c2,
                     f'18 Days episode: {clip} scripted in the iPhone simulator (Unlimited board, random seed, never a daily).')
        if j: jobs.append(j)

    def montage(date, slug, clip, season, caps, notes, maxlen=34, extra=None, head=0.0):
        ss, ln = side(clip, 'ss'), side(clip, 'len')
        if ss is None or ln is None: return
        t = ln + 0.3
        sp = max(1.0, t / maxlen)         # a longer montage is sped up to fit (fast cuts read as a montage)
        clips = [dict(file=f'{clip}.mp4', ss=round(max(0, ss - 0.1), 2), t=round(t, 2), speed=round(sp, 3))]
        if extra: clips = extra + clips if head else clips + extra
        total = sum(c['t'] / c.get('speed', 1) for c in clips)
        n = len(caps)
        seg = total / n
        cc = [[txt, round(i * seg + 0.3, 1), round((i + 1) * seg - 0.15, 1)] for i, txt in enumerate(caps)]
        jobs.append(dict(date=date, slug=slug, post_title=TITLES[date], season=season, notes=notes, captions=cc, clips=clips,
                         cover_at=round(total * 0.4, 1)))

    montage('2026-10-15', 'teaser', 'teaser', H, ['18 games.', 'One scoreboard.', 'A cast with opinions.', 'Tomorrow.'],
            'Teaser: fast cuts of six games, scripted in the simulator (Unlimited boards).', maxlen=16)
    intro_ss, intro_len = side('intro', 'ss'), side('intro', 'len')
    tour_ss, tour_len = side('tour', 'ss'), side('tour', 'len')
    extra = []
    if intro_ss is not None: extra.append(dict(file='intro.mp4', ss=round(max(0, intro_ss), 2), t=5.4))
    montage('2026-10-16', 'launch-trailer', 'trail', H, ['18 daily puzzles.', 'One scoreboard.', 'A cast with opinions.', 'Free. Your move.'],
            'Launch trailer: the cold-start intro, then nine games cut fast, scripted in the simulator.', maxlen=26, extra=extra, head=1)
    montage('2026-10-27', 'ph-18-games-30s', 'montage18', H, ['18 games in 30 seconds.', 'One score.'],
            'Product Hunt cut: all 18 games, one beat each, scripted in the simulator.', maxlen=32)
    montage('2026-10-30', 'halloween-eve', 'eve', H, ['HALLOWEEN EVE.', 'Every daily puzzle put on a costume.'],
            'Halloween Eve: eight games in the Halloween skin, scripted in the simulator.', maxlen=30)
    montage('2026-11-19', 'pocket-games', 'pocket', S, ['Pocket games for the table.', 'Rock Paper Scissors.', 'Tic-Tac-Tile.', 'Free against your friends.'],
            'Pocket games spotlight: RPS and Tic-Tac-Tile played to the finish against a scripted friend.', maxlen=40)
    # Oct 17 reveal: the season flipping on Home, then the cold-start opening in the Halloween cast
    rs, rl = side('reveal', 'ss'), side('reveal', 'len')
    if rs is not None and rl is not None:
        clips = [dict(file='reveal.mp4', ss=round(max(0, rs - 0.1), 2), t=round(min(18, rl + 0.3), 2))]
        if intro_ss is not None: clips.append(dict(file='intro.mp4', ss=round(max(0, intro_ss), 2), t=5.4))
        tot = sum(c['t'] for c in clips)
        jobs.append(dict(date='2026-10-17', slug='halloween-reveal', post_title=TITLES['2026-10-17'], season=H,
                         notes='The app flipping to Halloween on Home (haunted glass, costumed cast), then the cold-start opening animation in costume. Season preview via the harness, no account.',
                         captions=[['We did not update the app.', 0.4, 5.4], ['The app got dressed.', 5.6, round(tot - 0.2, 1)]], clips=clips,
                         cover_at=round(tot * 0.45, 1)))
    jobs.sort(key=lambda j: j['date'])
    json.dump(jobs, open(os.path.join(HERE, 'jobs.json'), 'w'), indent=1)
    print(len(jobs), 'jobs')


if __name__ == '__main__':
    build()
