# Cast-led reels, rendered in code from the REAL approved cast art (founder 10-04 / 10-14: never redraw, never ChatGPT
# flipbooks; W always friendly). Standard-season characters are the rigged hero puppets (rigplay.py, a port of the
# rig-engine player: breathing, blinks, wave, tap-hop + laugh). Halloween / Thanksgiving costume art has no rig, so it
# gets the same breathing + hop in a generic puppet (squash and stretch around the feet).
#
#   python3 docs/design/brand/social/jp45/video/cast-scene.py <slug> [...]     (no args = every scene)
#
# Each scene writes a 1080x1920 body (template background + wordmark + captions + handle) through ffmpeg, then
# make-video.finish() adds the 1.5 s end card, the cover frame and the manifest row.
import importlib.util, json, math, os, subprocess, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mv', os.path.join(HERE, 'make-video.py'))
mv = importlib.util.module_from_spec(spec); spec.loader.exec_module(mv)
sys.path.insert(0, HERE)
import rigplay, kit
from kit import font, hex2rgb, letter_tile

BRAND = mv.BRAND
W, H, FPS = 1080, 1920, 30
CAST = ['r', 'i', 'o1', 'o2', 'c', 'u', 'o3', 'd', 's', 'w']        # ladder rung order (bot-cast.ts)
NAMES = dict(r='Rip', i='Ivy', o1='Ollie', o2='Opal', c='Cosmo', u='Umi', o3='Ozzy', d='Dewey', s='Scoot', w='Webster')
COLORS = dict(r='#8E96A8', i='#4CC77A', o1='#FF9F1A', o2='#FF2F91', c='#00B4BE', u='#8B2CF5', o3='#F0782C', d='#0A6CFF', s='#F5A623', w='#9B3DF3')
TMP = mv.TMP


def art_path(cid, season, alt=None):
    if season in ('halloween', 'thanksgiving'):
        return os.path.join(BRAND, 'seasons', season, 'cast', cid + (f'-alt{alt}' if alt else '') + '.png')
    return os.path.join(BRAND, 'cast', 'hero', cid + '.png')


def ease_back(x, c=1.6):
    x = min(1, max(0, x))
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


class Actor:
    """One character on the stage. h = the visual height in px, (x, y) = bottom center (the feet). `rig` uses the hero puppet."""

    def __init__(self, cid, x, y, h, season='standard', alt=None, rig=None, t0=0.0, hops=(), flip=False, bob=1.0, seed=0, pop=True):
        self.cid, self.x, self.y, self.h, self.t0, self.hops, self.flip, self.bob, self.seed, self.pop = cid, x, y, h, t0, list(hops), flip, bob, seed, pop
        self.rig = None
        path = art_path(cid, season, alt)
        im = Image.open(path).convert('RGBA')
        if rig is None: rig = season == 'standard'
        if rig:
            self.rig = rigplay.Rig(cid)
            hb = Image.open(os.path.join(BRAND, 'cast', 'hero', cid + '.png')).getchannel('A').getbbox()
            S = self.rig.stage
            self.bb = (hb[0] + S['heroX'], hb[1] + S['heroY'], hb[2] + S['heroX'], hb[3] + S['heroY'])
            self.k = h / (hb[3] - hb[1])
        else:
            bb = im.getchannel('A').getbbox()
            self.bb = bb
            self.k = h / (bb[3] - bb[1])
            a = np.asarray(im).astype(np.float32) / 255.0
            a[..., :3] *= a[..., 3:4]
            self.src = a

    def tap(self, t):
        best = None
        for th in self.hops:
            if 0 <= t - th < 0.95: best = t - th
        return best

    def draw(self, canvas, t):
        """canvas: float32 premultiplied RGBA (H, W, 4), composited in place."""
        lt = t - self.t0
        if lt < 0: return
        pop = ease_back(lt / 0.45) if self.pop else 1.0
        if pop <= 0.01: return
        tap = self.tap(t)
        k = self.k
        if self.rig:
            arr = self.rig.render(t + self.seed, tap, k)
            x0, y0, x1, y1 = self.bb
            cx, by = (x0 + x1) / 2 * k, y1 * k
            if self.flip: arr = arr[:, ::-1]; cx = arr.shape[1] - cx
            # pop-in: scale about the feet
            if abs(pop - 1) > 1e-3:
                M = np.array([[pop, 0, cx - cx * pop], [0, pop, by - by * pop]], np.float64)
                arr = cv2.warpAffine(arr, M, (arr.shape[1], arr.shape[0]), flags=cv2.INTER_LINEAR)
            ox, oy = round(self.x - cx), round(self.y - by)
        else:
            x0, y0, x1, y1 = self.bb
            cx, by = (x0 + x1) / 2, y1
            hop = sq = 0.0
            if tap is not None:
                if tap < 0.08: sq = -0.05 * math.sin(tap / 0.08 * math.pi / 2)
                elif tap < 0.48:
                    p = (tap - 0.08) / 0.4; hop = -70 * math.sin(p * math.pi) / k * 1.0; sq = 0.03 * math.sin(p * math.pi)
                elif tap < 0.62: sq = -0.04 * math.sin((tap - 0.48) / 0.14 * math.pi)
            br = math.sin((t + self.seed) / 3.4 * math.pi * 2)
            sy = (1 + 0.012 * br * self.bob + sq) * pop; sx = (1 - 0.006 * br * self.bob - sq * 0.6) * pop
            sway = 1.2 * math.sin((t + self.seed) / 2.6 * math.pi * 2) * self.bob
            c, s_ = math.cos(math.radians(sway)), math.sin(math.radians(sway))
            # source -> output: translate feet to origin, squash/rotate, scale to px, translate to (x, y)
            A = np.array([[c * sx, -s_ * sy, 0], [s_ * sx, c * sy, 0], [0, 0, 1]], np.float64)
            T0 = np.array([[1, 0, -cx], [0, 1, -by], [0, 0, 1]], np.float64)
            Sk = np.array([[k * (-1 if self.flip else 1), 0, 0], [0, k, 0], [0, 0, 1]], np.float64)
            T1 = np.array([[1, 0, self.x], [0, 1, self.y + hop * k], [0, 0, 1]], np.float64)
            M = (T1 @ Sk @ A @ T0)[:2]
            arr = cv2.warpAffine(self.src, M, (W, H), flags=cv2.INTER_LINEAR)
            ox = oy = 0
        h, w = arr.shape[:2]
        sx0, sy0 = max(0, -ox), max(0, -oy)
        dx0, dy0 = max(0, ox), max(0, oy)
        cw, ch = min(w - sx0, W - dx0), min(h - sy0, H - dy0)
        if cw <= 0 or ch <= 0: return
        piece = arr[sy0:sy0 + ch, sx0:sx0 + cw]
        dst = canvas[dy0:dy0 + ch, dx0:dx0 + cw]
        dst[:] = piece + dst * (1 - piece[..., 3:4])


def shadow(canvas, x, y, w):
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(x), int(y)), (int(w / 2), int(w * 0.06)), 0, 0, 360, 0.30, -1, cv2.LINE_AA)
    m = cv2.GaussianBlur(m, (0, 0), w * 0.05)
    col = np.array([0.2, 0.08, 0.35], np.float32)
    canvas[..., :3] += (m[..., None] * col) * (1 - canvas[..., 3:4])
    canvas[..., 3] = np.maximum(canvas[..., 3], m * 0.6)


def img_to_arr(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


class Scene:
    def __init__(self, slug, date, season, seconds, captions, post_title, notes=''):
        self.slug, self.date, self.season, self.seconds, self.captions, self.post_title, self.notes = slug, date, season, seconds, captions, post_title, notes
        self.actors = []
        self.sprites = []         # (RGBA premult array at full canvas) static decorations drawn under actors
        self.deco = []            # callables (canvas, t) -> None drawn under the actors
        self.over = []            # callables drawn over the actors
        self.cap_cache = {}

    def caption_alpha(self, i, t):
        _, a, b = self.captions[i]
        fin = min(1, max(0, (t - a) / 0.3)); fout = min(1, max(0, (b - t) / 0.25))
        return min(fin, fout)

    def render(self, out_path):
        fpng = os.path.join(TMP, f'stage-{self.season}.png')
        if not os.path.exists(fpng):
            mv.frame_png(self.season, fpng, window=False)
        bg = np.asarray(Image.open(fpng).convert('RGB')).astype(np.float32) / 255.0
        caps = []
        for i, (txt, a, b) in enumerate(self.captions):
            p = os.path.join(TMP, f'{self.date}-{self.slug}-cap{i}.png'); mv.caption_png(txt, p)
            caps.append(img_to_arr(Image.open(p)))
        n = round(self.seconds * FPS)
        cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
               '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out_path]
        pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(n):
            t = f / FPS
            canvas = np.zeros((H, W, 4), np.float32)
            for d in self.deco: d(canvas, t)
            for a in sorted(self.actors, key=lambda a: a.y): a.draw(canvas, t)
            for d in self.over: d(canvas, t)
            frame = bg * (1 - canvas[..., 3:4]) + canvas[..., :3]
            for i, c in enumerate(caps):
                al = self.caption_alpha(i, t)
                if al > 0:
                    ca = c * al
                    frame = frame * (1 - ca[..., 3:4]) + ca[..., :3]
            pr.stdin.write((frame.clip(0, 1) * 255).astype(np.uint8).tobytes())
        pr.stdin.close(); pr.wait()
        job = dict(date=self.date, slug=self.slug, post_title=self.post_title, notes=self.notes, cover_at=min(4.0, self.seconds / 2))
        return mv.finish(job, out_path, f'{self.date}-{self.slug}', self.season)


def rr_sprite(w, h, r, fill, edge=None):
    im = Image.new('RGBA', (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((4, 4, w + 3, h + 3), r, fill=fill, outline=edge, width=4 if edge else 0)
    return im


def put(canvas, im, x, y, alpha=1.0):
    a = img_to_arr(im) * alpha
    h, w = a.shape[:2]
    x, y = round(x), round(y)
    sx0, sy0 = max(0, -x), max(0, -y); dx0, dy0 = max(0, x), max(0, y)
    cw, ch = min(w - sx0, W - dx0), min(h - sy0, H - dy0)
    if cw <= 0 or ch <= 0: return
    p = a[sy0:sy0 + ch, sx0:sx0 + cw]; d = canvas[dy0:dy0 + ch, dx0:dx0 + cw]
    d[:] = p + d * (1 - p[..., 3:4])


def tile_sprite(letter, size, color):
    return letter_tile(letter, size, color, shadow=True)


def text_sprite(s, size, fill=(255, 255, 255), stroke=mv.PURPLE, sw=6, weight='Black', width=W):
    im = Image.new('RGBA', (width, round(size * 1.6)), (0, 0, 0, 0))
    kit.text(im, s, width // 2, round(size * 0.8), size, fill=fill, stroke=stroke, sw=sw, weight=weight)
    return im


# ----------------------------------------------------------------------------- scenes
def scene_ladder(season='halloween'):
    """Oct 24 'Beat Webster': the ten bots climb the ladder, rung by rung, Webster at the top."""
    caps = [('Ten bots on the ladder.', 0.4, 3.4), ('Rip is a pushover.', 3.6, 6.4), ('Webster is not.', 6.6, 9.6),
            ('Nobody has cleared it. Yet.', 9.8, 13.2)]
    sc = Scene('beat-webster', '2026-10-24', season, 13.4, caps, '[Needs capture] Cast Saturday video: Beat Webster',
               'Cast art only: the ten bot-ladder characters (Halloween costume art, the season on Oct 24), puppet breathing + hops.')
    # two tiers: rungs 1-5 low, 6-10 high (a diagonal of ten overlapped into a pile)
    for i, cid in enumerate(CAST):
        row, j = divmod(i, 5)
        x = (140 + j * 200) if row == 0 else (130 + j * 175 if i != 9 else 850)
        y = (1560 if row == 0 else 1130) - j * 36
        col = COLORS[cid]
        stp = tile_sprite(str(i + 1), 110, col)
        sc.deco.append(lambda canvas, t, stp=stp, x=x, y=y, i=i: put(canvas, stp, x - stp.width / 2, y - 14, min(1, max(0, (t - (0.4 + i * 0.5)) / 0.3))))
        h = 250 if cid != 'w' else 330
        hops = [3.7] if cid == 'r' else [7.0, 7.9] if cid == 'w' else [0.4 + i * 0.5 + 0.2]
        sc.actors.append(Actor(cid, x, y - 12, h, season=season, t0=0.4 + i * 0.5, hops=hops, seed=i * 0.7))
    return sc


def scene_costumes(season='halloween'):
    """Oct 31: three costume winners on a podium (alt costumes), the rest of the cast cheering behind."""
    caps = [('HALLOWEEN.', 0.4, 3.0), ('Three winners. Three very good costumes.', 3.2, 9.0), ('Congrats to everyone who dressed up.', 9.2, 13.4)]
    sc = Scene('costume-winners', '2026-10-31', season, 13.6, caps, '[Needs capture] Halloween cast video: costume winners',
               'Cast art only: Halloween costume art on a podium, puppet breathing + hops, confetti tiles.')
    px = {2: 270, 1: 540, 3: 810}
    ph = {1: 330, 2: 250, 3: 190}
    pods = {1: ('c', 1), 2: ('o2', 1), 3: ('s', 2)}
    by = 1560
    for place, (cid, alt) in pods.items():
        x, hh = px[place], ph[place]
        blk = rr_sprite(250, hh, 28, hex2rgb(COLORS[cid]) + (255,), (255, 255, 255, 230))
        d = ImageDraw.Draw(blk)
        d.text((blk.width // 2, hh // 2 + 8), str(place), font=font(130, 'Black'), fill=(255, 255, 255), anchor='mm', stroke_width=6, stroke_fill=(70, 30, 120))
        t0 = 1.0 + (3 - place) * 0.9
        sc.deco.append(lambda canvas, t, blk=blk, x=x, hh=hh, t0=t0: put(canvas, blk, x - blk.width / 2, by - hh + 30, min(1, max(0, (t - t0 + 0.4) / 0.3))))
        sc.actors.append(Actor(cid, x, by - hh + 30, 330 if place == 1 else 290, season=season, alt=alt, t0=t0, hops=[t0 + 0.3, t0 + 5.0], seed=place))
    # the rest of the cast cheers from the back
    for j, cid in enumerate(['r', 'i', 'o1', 'u', 'd', 'w']):
        x = [90, 990, 1000, 70, 960, 120][j]
        y = [1180, 1180, 960, 980, 780, 800][j]
        sc.actors.append(Actor(cid, x, y, 210, season=season, alt=None, t0=3.4 + j * 0.25, hops=[9.4 + j * 0.15], seed=j))
    # falling confetti tiles
    rnd = np.random.RandomState(3)
    conf = [(rnd.randint(60, 1020), rnd.uniform(0, 4), rnd.uniform(160, 300), tile_sprite(rnd.choice(list('WORDOCIUS')), 62, ['#F0782C', '#8B2CF5', '#FF9F1A', '#9B3DF3'][j % 4])) for j in range(14)]
    def confetti(canvas, t):
        if t < 2.0: return
        for x, off, sp, spr in conf:
            y = ((t - 2.0 + off) * sp) % 1900 - 80
            put(canvas, spr, x - spr.width / 2, y)
    sc.over.append(confetti)
    return sc


def scene_cleanup(season='halloween'):
    """Nov 1: the costumes are wiped off by a sweep; the standard hero puppets take the stage."""
    caps = [('The cast cleaned up.', 0.4, 4.0), ('Halloween is over.', 4.2, 7.6), ('The candy never happened.', 7.8, 11.6)]
    sc = Scene('cast-cleanup', '2026-11-01', 'standard', 11.8, caps, '[Needs capture] Cast gag: cleaning up after Halloween',
               'Cast art only: the Halloween costume art swept away left to right, the hero puppets (blink, wave) underneath.')
    order = ['w', 'i', 'o1', 'o2', 'c', 'u', 'o3', 'd', 's', 'r']
    pos = [(270, 760), (540, 760), (810, 760), (180, 1120), (450, 1120), (720, 1120), (960, 1120), (270, 1480), (540, 1480), (810, 1480)]
    heroes, costumes = [], []
    for j, (cid, (x, y)) in enumerate(zip(order, pos)):
        hh = 290
        heroes.append(Actor(cid, x, y, hh, season='standard', t0=0.0, pop=False, seed=j * 0.6, hops=[4.6 + j * 0.1]))
        costumes.append(Actor(cid, x, y, hh, season='halloween', t0=0.0, pop=False, seed=j * 0.6, hops=[]))
    # sweep position: x of the wipe edge over time
    def edge(t): return -200 + (1080 + 400) * min(1, max(0, (t - 2.4) / 1.8))
    class Wipe:
        def __init__(self, parts, keep_left): self.parts, self.keep_left = parts, keep_left
        def draw(self, canvas, t): pass
    def draw_layers(canvas, t):
        a = np.zeros((H, W, 4), np.float32); b = np.zeros((H, W, 4), np.float32)
        for c in costumes: c.draw(a, t)
        for hr in heroes: hr.draw(b, t)
        e = edge(t)
        xs = np.arange(W, dtype=np.float32)[None, :, None]
        m = np.clip((xs - e) / 60.0, 0, 1)            # 1 on the right of the wipe (costumes still there)
        out = b * (1 - m) + a * m
        canvas[:] = out + canvas * (1 - out[..., 3:4])
        # the sweep: candy wrappers pushed along the wipe edge
        if 2.3 < t < 4.5:
            for k in range(9):
                yy = 640 + k * 150 + 20 * math.sin(t * 6 + k)
                put(canvas, spr_candy[k % len(spr_candy)], e - 30 - 14 * (k % 3), yy)
    spr_candy = [tile_sprite(ch, 70, col) for ch, col in zip('CNDYWS', ['#F0782C', '#FF9F1A', '#8B2CF5', '#9B3DF3', '#F0782C', '#FF9F1A'])]
    sc.deco.append(draw_layers)
    return sc


def scene_meet(cid, date, season, rung, line1, line2, post_title, hops=(5.5, 9.5)):
    """Meet-the-bot Cast Saturday: the character large, the name in tiles, the ladder position."""
    name = NAMES[cid]
    caps = [(f'Meet {name}, rung {rung} on the bot ladder.', 0.5, 5.2), (line1, 5.4, 10.0), (line2, 10.2, 14.4)]
    sc = Scene(f'meet-{name.lower()}', date, season, 14.6, caps, post_title,
               f'Cast art only: {name} ({"hero puppet with blink and tap-laugh" if season == "standard" else season + " costume art, puppet breathing + hops"}).')
    sc.actors.append(Actor(cid, 540, 1210, 760, season=season, t0=0.3, hops=list(hops), seed=0.5))
    # the name in glossy letter tiles
    sprs = [tile_sprite(ch, 150, COLORS[cid]) for ch in name.upper()]
    tw = sum(s.width - 20 for s in sprs)
    def name_tiles(canvas, t):
        x = (W - tw) / 2
        for i, s in enumerate(sprs):
            d = ease_back((t - 0.2 - i * 0.12) / 0.4)
            if d > 0:
                y = 230 + 40 * (1 - min(1, d))
                put(canvas, s, x - 10, y, min(1, d))
            x += s.width - 20
    sc.deco.append(name_tiles)
    # ladder dots, this rung lit
    def ladder(canvas, t):
        for i in range(10):
            x = 140 + i * 88
            on = (i + 1 == rung)
            im = Image.new('RGBA', (70, 70), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
            d.ellipse((4, 4, 66, 66), fill=(255, 255, 255, 255 if on else 110), outline=hex2rgb(COLORS[cid]) + (255,) if on else None, width=6)
            d.text((35, 36), str(i + 1), font=font(34, 'Black'), fill=hex2rgb(COLORS[cid]) if on else (110, 70, 160), anchor='mm')
            put(canvas, im, x - 35, 1465 - (14 if on else 0), min(1, max(0, (t - 1.5) / 0.4)))
    sc.deco.append(ladder)
    return sc


def scene_reveal_tg():
    """Nov 16 Thanksgiving reveal: the cast stands in hero looks, a burst, then the Thanksgiving costume art."""
    caps = [('The app knows what month it is.', 0.5, 4.0), ('Again.', 4.2, 6.0), ('Open the app and see what the cast is wearing.', 6.2, 12.4)]
    sc = Scene('thanksgiving-reveal', '2026-11-16', 'standard', 12.6, caps, '[Needs capture] Thanksgiving transformation reveal (move to the ship date)',
               'Cast art only (no Thanksgiving build is on main yet, so the real app flip could not be recorded): hero puppets cross-fade to the Thanksgiving costume art on a burst; the end card sits on the standard sky.')
    order = ['w', 'i', 'o1', 'o2', 'c', 'u', 'o3', 'd', 's', 'r']
    pos = [(270, 760), (540, 760), (810, 760), (180, 1120), (450, 1120), (720, 1120), (960, 1120), (270, 1480), (540, 1480), (810, 1480)]
    heroes = [Actor(c, x, y, 290, season='standard', pop=False, seed=j * 0.6, hops=[]) for j, (c, (x, y)) in enumerate(zip(order, pos))]
    fall = [Actor(c, x, y, 290, season='thanksgiving', pop=False, seed=j * 0.6, hops=[6.0 + 0.15 * j]) for j, (c, (x, y)) in enumerate(zip(order, pos))]
    def layers(canvas, t):
        a = np.zeros((H, W, 4), np.float32); b = np.zeros((H, W, 4), np.float32)
        for h_ in heroes: h_.draw(a, t)
        for f_ in fall: f_.draw(b, t)
        m = min(1, max(0, (t - 4.6) / 0.5))
        out = a * (1 - m) + b * m
        canvas[:] = out + canvas * (1 - out[..., 3:4])
        # burst ring
        if 4.5 < t < 5.5:
            p = (t - 4.5)
            r = 60 + 1100 * p
            ring = np.zeros((H, W), np.float32)
            cv2.circle(ring, (540, 1100), int(r), 1.0, 40, cv2.LINE_AA)
            ring = cv2.GaussianBlur(ring, (0, 0), 6) * (1 - p) * 0.8
            canvas[..., :3] += ring[..., None] * np.array([1, 0.85, 0.45], np.float32)
            canvas[..., 3] = np.maximum(canvas[..., 3], ring)
    sc.deco.append(layers)
    return sc


SCENES = {
    'beat-webster': scene_ladder,
    'costume-winners': scene_costumes,
    'cast-cleanup': scene_cleanup,
    'meet-cosmo': lambda: scene_meet('c', '2026-11-07', 'standard', 5, 'Bold openers. Big swings. No fear.', 'Beat Cosmo and the boss is five rungs up.', '[Needs capture] Cast Saturday video: Cosmo'),
    'meet-opal': lambda: scene_meet('o2', '2026-11-14', 'thanksgiving', 4, 'A little dramatic.', 'Every win is a standing ovation. Beat her anyway.', '[Needs capture] Cast Saturday video: Opal'),
    'meet-umi': lambda: scene_meet('u', '2026-11-28', 'thanksgiving', 6, 'Umi plays like you play.', 'Warm up well and she gets sharp.', '[Needs capture] Cast Saturday video: Umi'),
    'thanksgiving-reveal': scene_reveal_tg,
}


def main():
    want = sys.argv[1:] or list(SCENES)
    os.makedirs(TMP, exist_ok=True)
    mpath = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else []
    for name in want:
        sc = SCENES[name]()
        print('render', name, flush=True)
        out = os.path.join(TMP, f'{sc.date}-{sc.slug}-body.mp4')
        row = sc.render(out)
        manifest = [m for m in manifest if not (m['date'] == row['date'] and m['post_title'] == row['post_title'])] + [row]
        manifest.sort(key=lambda m: m['date'])
        json.dump(manifest, open(mpath, 'w'), indent=1)


if __name__ == '__main__':
    main()
