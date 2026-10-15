# Finishes the vetted ChatGPT extras in incoming/extra/ into extra/ (story, carousel, Product Hunt, contest, POTW, highlight covers).
#   python3 build_extra.py            builds every extra that has a candidate in incoming/extra/ and logs extra/manifest.json
# Mascots are compared against cast/hero art in extra/raw/compare-<slug>.jpg (scene.review). Candidates are moved to the scratchpad after building.
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scene as S          # noqa: E402
import compose as C        # noqa: E402

INC = os.path.join(HERE, 'incoming', 'extra')
OUT = os.path.join(HERE, 'extra')
RAW = os.path.join(OUT, 'raw')
KEEP = '/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad/accepted'
S.FMT_OF.update({'story': (1080, 1920), 'ph': (1270, 760)})
os.makedirs(RAW, exist_ok=True); os.makedirs(KEEP, exist_ok=True)
QUEUE = {x['id']: x for x in json.load(open(os.path.join(INC, 'queue.json')))['queue']}


def wm_overlay(im, wm_w, wm_top, footer=None, foot_y=None, foot_size=30, dark=False):
    W, H = im.size
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    wm = C.wordmark(); wmh = round(wm_w * wm.height / wm.width)
    wmi = wm.resize((wm_w, wmh), Image.LANCZOS)
    hm = Image.new('L', im.size, 0)
    hm.paste(wmi.getchannel('A').filter(ImageFilter.MaxFilter(13)), ((W - wm_w) // 2, wm_top))
    layer.paste(Image.new('RGBA', im.size, (255, 244, 255, 255)), (0, 0), hm.filter(ImageFilter.GaussianBlur(wmh * 0.22)).point(lambda v: min(255, int(v * 0.9))))
    C.drop_shadow(layer, wmi, (W - wm_w) / 2, wm_top, dark=(40, 10, 80), a=150, blur=0.05, dy=0.08)
    layer.alpha_composite(wmi, ((W - wm_w) // 2, wm_top))
    if footer:
        C.text(layer, footer, W / 2, foot_y, foot_size, fill=(236, 224, 255) if dark else C.PURPLE_DEEP, weight='ExtraBold', shadow=dark)
    base = im.convert('RGBA'); base.alpha_composite(layer)
    return base.convert('RGB')


def done(cid, slug, due, files, caption, mascot, notes=''):
    src = os.path.join(INC, cid + '.png')
    if os.path.exists(src):
        S.FULL = INC
        try:
            S.review(cid, os.path.join(RAW, f'compare-{slug}.jpg'), src)
        except Exception as e:            # square sheets have no cast list worth comparing
            print('review skipped', cid, e)
        os.replace(src, os.path.join(KEEP, cid + '.png'))
    mp = os.path.join(OUT, 'manifest.json')
    m = json.load(open(mp)) if os.path.exists(mp) else []
    m = [r for r in m if r['slug'] != slug]
    m.append(dict(slug=slug, due=due, files=files, caption=caption, mascot_check=mascot, notes=notes))
    m.sort(key=lambda r: (r['due'], r['slug']))
    json.dump(m, open(mp, 'w'), indent=2)
    print('built', slug)


def load(cid, recolor=None):
    im = Image.open(os.path.join(INC, cid + '.png')).convert('RGB')
    if recolor:
        season, series, y0, y1 = recolor[:4]
        im = S.recolor_headline(im, season, series, y0, y1)
    return im


def story(cid, slug, due, season, caption, mascot, recolor=None, top=250):
    im = load(cid, recolor)
    s = 1080 / im.width
    out = S.fit_scene(im, 'story', s, top)
    out = wm_overlay(out, 520, 96)
    fn = f'{slug}.png'; out.save(os.path.join(OUT, fn), optimize=True)
    done(cid, slug, due, {'story': fn}, caption, mascot, 'IG story 1080x1920: scene top extended with its own blurred margin so the wordmark sits in the top safe band; empty center kept for the day board; no footer (stories post from the account).')


def feed(cid, slug, due, season, caption, mascot, scale, top, recolor=None, fill_top=None, footer=True):
    im = load(cid, recolor)
    out = S.fill_scene(im, 'portrait', fill_top) if fill_top is not None else S.fit_scene(im, 'portrait', scale, top)
    L = C.LAYOUT['portrait']
    out = wm_overlay(out, L['wm_w'], L['wm_top'], C.HANDLE['feed'] + ' · wordocious.com' if footer else None, L['foot_y'], L['foot_size'], season in C.DARK)
    fn = f'{slug}.png'; out.save(os.path.join(OUT, fn), optimize=True)
    done(cid, slug, due, {'portrait': fn}, caption, mascot)


def ph(cid, slug, due, caption, mascot, y0):
    im = load(cid)
    s = 0.80
    rows = round(760 / s)
    im = im.crop((0, y0, im.width, y0 + rows))
    out = S.fit_scene(im, 'ph', s, 0)
    fn = f'{slug}.png'; out.save(os.path.join(OUT, fn), optimize=True)
    done(cid, slug, due, {'gallery': fn}, caption, mascot, 'Product Hunt gallery 1270x760 (scene scaled 0.80, vertical window chosen per image, 20 px side margins blurred). No wordmark/footer overlay: the PH page shows the brand.')


def key_cyan(tile):
    """Cut the icons out of a flat cyan sheet: alpha from the distance to the sheet's background color, then despill."""
    a = np.asarray(tile.convert('RGB')).astype(np.float32)
    bg = np.median(np.concatenate([a[:6, :].reshape(-1, 3), a[-6:, :].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]), axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    # background also vignettes slightly: use hue closeness to cyan as a second cue
    hsv = np.asarray(tile.convert('HSV')).astype(np.float32)
    H = hsv[..., 0] * 360 / 255
    cyanish = (np.abs(H - 183) < 14) & (hsv[..., 1] > 90)
    alpha = np.clip((d - 38) / 40, 0, 1)
    alpha = np.where(cyanish & (d < 90), np.minimum(alpha, np.clip((d - 38) / 60, 0, 1)), alpha)
    alpha = ndimage.binary_opening(alpha > 0.5, iterations=2).astype(np.float32) * 0 + ndimage.gaussian_filter(alpha, 0.8)
    # keep only components that are big enough (drops stray spots)
    lab, n = ndimage.label(alpha > 0.5)
    if n:
        sizes = ndimage.sum(alpha > 0.5, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 1500])
        keep = ndimage.binary_dilation(keep, iterations=3)
        alpha *= keep
    # despill cyan from edge pixels: pull the blue/green excess down toward the red channel average
    rgb = a.copy()
    edge = (alpha > 0.02) & (alpha < 0.98)
    spill = np.clip(np.minimum(rgb[..., 1], rgb[..., 2]) - rgb[..., 0] * 1.0, 0, 255)
    for ch in (1, 2):
        rgb[..., ch] = np.where(edge & cyanish, rgb[..., ch] - spill * 0.8, rgb[..., ch])
    out = np.dstack([rgb.clip(0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def disc_cover(icon):
    W = 1080
    bg = np.zeros((W, W, 3), np.float32)
    yy, xx = np.mgrid[0:W, 0:W]
    r = np.hypot(xx - W / 2, yy - W / 2) / (W / 2)
    top, bot = np.array([150, 112, 232], np.float32), np.array([112, 74, 200], np.float32)
    t = (yy / W)[..., None]
    bg = top * (1 - t) + bot * t
    im = Image.fromarray(bg.astype(np.uint8)).convert('RGBA')
    # calm lighter disc with a soft rim and shadow
    D = 840
    disc = Image.new('RGBA', (W, W), (0, 0, 0, 0)); dd = ImageDraw.Draw(disc)
    dd.ellipse((W / 2 - D / 2, W / 2 - D / 2 + 18, W / 2 + D / 2, W / 2 + D / 2 + 18), fill=(60, 20, 120, 90))
    disc = disc.filter(ImageFilter.GaussianBlur(26))
    im.alpha_composite(disc)
    d2 = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d2d = ImageDraw.Draw(d2)
    d2d.ellipse((W / 2 - D / 2, W / 2 - D / 2, W / 2 + D / 2, W / 2 + D / 2), fill=(226, 206, 255, 255))
    g = np.asarray(d2).copy().astype(np.float32)
    rr = np.hypot(xx - W / 2, yy - W / 2) / (D / 2)
    inner = np.array([240, 226, 255], np.float32); outer = np.array([205, 180, 250], np.float32)
    col = inner * (1 - np.clip(rr, 0, 1)[..., None] ** 1.5) + outer * (np.clip(rr, 0, 1)[..., None] ** 1.5)
    g[..., :3] = col
    im.alpha_composite(Image.fromarray(g.astype(np.uint8), 'RGBA'))
    # icon, fitted into ~560 px, with a soft contact shadow, centered on the disc
    bb = icon.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    icon = icon.crop(bb)
    k = 600 / max(icon.size)
    icon = icon.resize((round(icon.width * k), round(icon.height * k)), Image.LANCZOS)
    x, y = (W - icon.width) // 2, (W - icon.height) // 2
    sh = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    m = Image.new('L', (W, W), 0); m.paste(icon.getchannel('A'), (x + 6, y + 18))
    sh.paste(Image.new('RGBA', (W, W), (70, 30, 130, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.35)))
    im.alpha_composite(sh); im.alpha_composite(icon, (x, y))
    return im.convert('RGB')


def highlights(cid, names, due):
    sheet = Image.open(os.path.join(INC, cid + '.png')).convert('RGB')
    w, h = sheet.size
    quads = [(0, 0, w // 2, h // 2), (w // 2, 0, w, h // 2), (0, h // 2, w // 2, h), (w // 2, h // 2, w, h)]
    for q, (slug, cap, mc) in zip(quads, names):
        tile = sheet.crop(q)
        icon = key_cyan(tile)
        out = disc_cover(icon)
        fn = f'{slug}.png'; out.save(os.path.join(OUT, fn), optimize=True)
        done('', slug, due, {'cover': fn}, cap, mc, 'IG highlight cover 1080x1080: icon keyed off the cyan sheet, centered on a calm purple disc. No text.')
    src = os.path.join(INC, cid + '.png')
    if os.path.exists(src):
        os.replace(src, os.path.join(KEEP, cid + '.png'))


if __name__ == '__main__':
    which = set(sys.argv[1:])
    run = lambda k: (not which) or k in which
    # --- Oct 16 launch carousel (5 x 1080x1350)
    cars = [('2026-10-16-carousel-1', 'W, D, S, C, O1 lineup: 18 DAILY GAMES. ONE SCORE. Bring your family.', ['w', 'd', 's', 'c', 'o1']),
            ('2026-10-16-carousel-2', 'PLAY EVERY DAILY: C and I with three glossy game tiles.', ['c', 'i']),
            ('2026-10-16-carousel-3', 'RACE YOUR FRIENDS: S and U through a finish ribbon.', ['s', 'u']),
            ('2026-10-16-carousel-4', 'A CAST WITH OPINIONS: D (skeptical), O2 (sunglasses), R (sleepy).', ['d', 'o2', 'r']),
            ('2026-10-16-carousel-5', 'FREE ON WEB, IOS AND ANDROID: W beside a generic phone and laptop.', ['w'])]
    for cid, cap, cast in cars:
        if run('carousel') and os.path.exists(os.path.join(INC, cid + '.png')):
            feed(cid, cid, '2026-10-16', 'standard', cap, 'pass (checked vs hero): ' + ', '.join(cast), 0.82, 96)
    # --- stories (IG 1080x1920)
    ST = [('2026-10-17-story-dressed', '2026-10-17', 'halloween', 'THE APP GOT DRESSED. story: W (vampire) and I (scarecrow) low at the corners, empty center.', 'pass (checked vs Halloween costume art): w vampire, i scarecrow', None),
          ('2026-10-18-story-sweep', '2026-10-18', 'halloween', 'SWEEP SUNDAY story: U (fairy-ghost) and S (skeleton), empty center for the sweep board.', 'pass (checked vs Halloween costume art): u fairy-ghost, s skeleton', ('halloween', 'sweep', 100, 480)),
          ('2026-10-19-story-monday', '2026-10-19', 'halloween', 'MONDAY MASTERS story: C (astronaut) and D (wizard), empty center for the leaderboard.', 'pass (checked vs Halloween costume art): c astronaut, d wizard', ('halloween', 'monday', 135, 540)),
          ('2026-10-25-story-sweep', '2026-10-25', 'halloween', 'SWEEP SUNDAY story: O3 (mummy) and R (ghost sheet), empty center.', 'pass (checked vs Halloween costume art): o3 mummy, r ghost', ('halloween', 'sweep', 130, 530)),
          ('2026-10-26-story-monday', '2026-10-26', 'halloween', 'MONDAY MASTERS story: W (vampire) and I (scarecrow), empty center.', 'pass (checked vs Halloween costume art): w vampire, i scarecrow', ('halloween', 'monday', 130, 500)),
          ('2026-11-01-story-sweep', '2026-11-01', 'standard', 'SWEEP SUNDAY story: S and C, empty center.', 'pass (checked vs hero): s, c', None),
          ('2026-11-02-story-monday', '2026-11-02', 'standard', 'MONDAY MASTERS story: D and O1, empty center.', 'pass (checked vs hero): d, o1', ('standard', 'monday', 90, 500)),
          ('2026-11-22-story-sweep', '2026-11-22', 'thanksgiving', 'SWEEP SUNDAY story: W and R on the harvest wall, empty center.', 'pass (checked vs Thanksgiving art): w, r', ('thanksgiving', 'sweep', 85, 540)),
          ('2026-11-23-story-monday', '2026-11-23', 'thanksgiving', 'MONDAY MASTERS story: I and O1 on the harvest wall, empty center.', 'pass (checked vs Thanksgiving art): i, o1', ('thanksgiving', 'monday', 80, 470))]
    for cid, due, season, cap, mc, rc in ST:
        if run('story') and os.path.exists(os.path.join(INC, cid + '.png')):
            story(cid, cid, due, season, cap, mc, rc)
    # --- Product Hunt gallery (5 x 1270x760) + thumbnail
    PH = [('2026-10-27-ph-1', '18 DAILY GAMES. ONE SCORE. Bring your family. W, D, S, C, O1.', 'pass (checked vs hero): w, d, s, c, o1', 40),
          ('2026-10-27-ph-2', '18 GAMES. ONE APP. D and C beside 18 purple/gold/grey tiles.', 'pass (checked vs hero): d, c', 70),
          ('2026-10-27-ph-3', 'RACE YOUR FRIENDS: S and O3 through a checkered finish ribbon.', 'pass (checked vs hero): s, o3', 25),
          ('2026-10-27-ph-4', 'DRESS UP THE CAST: Halloween costumes (I scarecrow, W vampire, R ghost).', 'pass (checked vs Halloween costume art): i, w, r', 20),
          ('2026-10-27-ph-5', 'FREE EVERYWHERE: web, iOS, Android with W and U beside a generic phone and laptop.', 'pass (checked vs hero): w, u', 50)]
    for cid, cap, mc, y0 in PH:
        if run('ph') and os.path.exists(os.path.join(INC, cid + '.png')):
            ph(cid, cid, '2026-10-27', cap, mc, y0)
    t = os.path.join(INC, '2026-10-27-ph-thumb.png')
    if run('ph') and os.path.exists(t):
        Image.open(t).convert('RGB').resize((240, 240), Image.LANCZOS).save(os.path.join(OUT, '2026-10-27-ph-thumb.png'), optimize=True)
        done('2026-10-27-ph-thumb', '2026-10-27-ph-thumb', '2026-10-27', {'thumbnail': '2026-10-27-ph-thumb.png'}, 'Product Hunt thumbnail 240x240: W friendly and waving, no text.', 'pass (checked vs hero): w')
    # --- contest + player-of-the-week frames (1080x1350)
    for cid, slug, due, season, cap, mc, kw in [
            ('2026-10-28-contest-howto', '2026-10-28-contest-howto', '2026-10-28', 'halloween', 'ENTER THE COSTUME CONTEST: three numbered steps (dress your mascot, share the card, tag us); S skeleton, C astronaut, O2 witch.', 'pass (checked vs Halloween costume art): s skeleton, c astronaut, o2 witch', dict(scale=0.82, top=96)),
            ('2026-10-30-contest-winners', '2026-10-30-contest-winners', '2026-10-30', 'halloween', 'WINNERS frame: three empty round frames above a 1-2-3 podium for the winners\' mascots; no characters.', 'n/a (no mascots; frames are empty)', dict(scale=None, top=None, fill_top=-127)),
            ('2026-11-13-ugc-frame', '2026-11-13-ugc-frame', '2026-11-13', 'standard', 'PLAYER OF THE WEEK frame: S, U, C cheering along the bottom, large empty center for the player\'s share card.', 'pass (checked vs hero): s, u, c', dict(scale=0.84, top=92))]:
        if run('frames') and os.path.exists(os.path.join(INC, cid + '.png')):
            feed(cid, slug, due, season, cap, mc, kw.get('scale'), kw.get('top'), fill_top=kw.get('fill_top'))
    # --- highlight covers (8 x 1080x1080) from the two icon sheets
    if run('highlights'):
        if os.path.exists(os.path.join(INC, '2026-10-16-highlights-1.png')):
            highlights('2026-10-16-highlights-1', [('2026-10-16-highlight-dailies', 'Highlight cover: calendar with a star (Dailies).', 'n/a (object icon)'),
                                                   ('2026-10-16-highlight-vs', 'Highlight cover: crossed checkered flags (VS / racing).', 'n/a (object icon)'),
                                                   ('2026-10-16-highlight-meet-w', 'Highlight cover: W mascot, friendly, caped (Meet the cast).', 'pass (checked vs hero): w'),
                                                   ('2026-10-16-highlight-learn', 'Highlight cover: open book with a sparkle (How to play).', 'n/a (object icon)')], '2026-10-16')
        if os.path.exists(os.path.join(INC, '2026-10-16-highlights-2.png')):
            highlights('2026-10-16-highlights-2', [('2026-10-16-highlight-muddle', 'Highlight cover: scrambled purple/gold/grey tiles (Muddle).', 'n/a (object icon)'),
                                                   ('2026-10-16-highlight-halloween', 'Highlight cover: glowing jack-o-lantern (Halloween).', 'n/a (object icon)'),
                                                   ('2026-10-16-highlight-quiz', 'Highlight cover: lightbulb with a question mark (Word of the Day quiz).', 'n/a (object icon)'),
                                                   ('2026-10-16-highlight-winners', 'Highlight cover: gold trophy with a purple star (Winners).', 'n/a (object icon)')], '2026-10-16')
