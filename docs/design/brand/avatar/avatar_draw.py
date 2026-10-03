# Draws a mascot from the core layout (dump-layout.ts output) with PIL — the same recipe the apps use:
# body art tinted by multiply (flat hex or gradient stops), pattern shapes clipped to the body alpha and
# multiplied, the white initial, then every part rect (white accessories tinted by the accessory color).
import math, os
from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, 'parts')
_cache = {}
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'


def art(name):
    if name not in _cache:
        _cache[name] = Image.open(os.path.join(PARTS, name + '.png')).convert('RGBA')
    return _cache[name]


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fill_image(size, color):
    """A flat or gradient fill (color = core AvatarColor dict)."""
    w, h = size
    stops = color.get('stops')
    if not stops:
        return Image.new('RGB', size, hexrgb(color['hex']))
    d = color.get('dir', 'v')
    n = len(stops) - 1
    cols = [hexrgb(s) for s in stops]
    line = []
    L = w if d == 'h' else h if d == 'v' else w + h
    for i in range(L):
        t = i / max(1, L - 1) * n
        k = min(int(t), n - 1)
        f = t - k
        line.append(tuple(round(cols[k][j] * (1 - f) + cols[k + 1][j] * f) for j in range(3)))
    im = Image.new('RGB', size)
    px = im.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = line[x if d == 'h' else y if d == 'v' else x + y]
    return im


def tinted(im, color):
    """Multiply a white-glossy RGBA by a flat/gradient color, keeping alpha."""
    f = fill_image(im.size, color)
    m = ImageChops.multiply(im.convert('RGB'), f).convert('RGBA')
    m.putalpha(im.getchannel('A'))
    return m


def star_pts(x, y, r, inner, n):
    pts = []
    for i in range(n * 2):
        rr = r if i % 2 == 0 else inner
        a = -math.pi / 2 + i * math.pi / n
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    return pts


def draw_pattern(size, shapes, base, ink):
    """The pattern layer (RGB over the base color) in body-square pixels."""
    img = Image.new('RGBA', (size, size), hexrgb(base['hex']) + (255,))
    col = {'ink': hexrgb(ink['hex']), 'base': hexrgb(base['hex']), 'light': (255, 255, 255)}
    for s in shapes:
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        if s['t'] == 'grad':
            # vertical/diagonal alpha ramp of one color
            g = Image.new('RGBA', (size, size))
            gp = g.load()
            (o0, c0, a0), (o1, c1, a1) = s['stops'][0], s['stops'][-1]
            vx, vy = s['x2'] - s['x1'], s['y2'] - s['y1']
            L2 = vx * vx + vy * vy
            for yy in range(0, size):
                for xx in range(0, size):
                    t = ((xx / size - s['x1']) * vx + (yy / size - s['y1']) * vy) / L2
                    t = min(1, max(0, t))
                    gp[xx, yy] = col[c0] + (round(255 * (a0 + (a1 - a0) * t)),)
            img.alpha_composite(g)
            continue
        c = col[s['c']] + (round(255 * s.get('a', 1)),)
        P = lambda v: v * size
        if s['t'] == 'rect':
            d.rectangle([P(s['x']), P(s['y']), P(s['x'] + s['w']), P(s['y'] + s['h'])], fill=c)
        elif s['t'] == 'circle':
            d.ellipse([P(s['x'] - s['r']), P(s['y'] - s['r']), P(s['x'] + s['r']), P(s['y'] + s['r'])], fill=c)
        elif s['t'] == 'star':
            d.polygon([(P(a), P(b)) for a, b in star_pts(s['x'], s['y'], s['r'], s['inner'], s['n'])], fill=c)
        elif s['t'] == 'heart':
            x, y, k = s['x'], s['y'], s['s']
            d.ellipse([P(x - k), P(y - k * 0.75), P(x), P(y + k * 0.25)], fill=c)
            d.ellipse([P(x), P(y - k * 0.75), P(x + k), P(y + k * 0.25)], fill=c)
            d.polygon([(P(x - k * 0.97), P(y - k * 0.1)), (P(x + k * 0.97), P(y - k * 0.1)), (P(x), P(y + k))], fill=c)
        elif s['t'] == 'poly':
            d.polygon([(P(a), P(b)) for a, b in s['pts']], fill=c)
        img.alpha_composite(layer)
    return img.convert('RGB')


def render(entry, size=300, bg=(237, 233, 254, 255), letter='A', show_bounds=False, pad_frame=None):
    lay = entry['layout']
    cfg = entry['config']
    out = Image.new('RGBA', (size, size), bg)
    acc = entry.get('accColor')

    def box(r):
        return round(r['x'] * size), round(r['y'] * size), max(1, round(r['w'] * size)), max(1, round(r['h'] * size))

    for L in lay['layers']:
        x, y, w, h = box(L['rect'])
        if L['layer'] == 'body':
            b = art(L['art']).resize((w, h), Image.LANCZOS)
            body = tinted(b, entry['color'])
            if cfg['pattern'] != 'solid' and entry['pattern']:
                pat = draw_pattern(w, entry['pattern'], entry['color'], entry['patternColor'])
                m = ImageChops.multiply(b.convert('RGB'), pat).convert('RGBA')
                m.putalpha(b.getchannel('A'))
                body = m
            out.alpha_composite(body, (x, y))
            # letter
            lx, ly, lw, lh = box(lay['letter'])
            try:
                f = ImageFont.truetype(FONT, max(6, int(lh * 1.05)))
            except Exception:
                f = ImageFont.load_default()
            ImageDraw.Draw(out).text((lx + lw / 2, ly + lh / 2), letter, font=f, fill='white', anchor='mm')
            continue
        im = art(L['art']).resize((w, h), Image.LANCZOS)
        if L['tint'] and acc:
            im = tinted(im, acc)
        out.alpha_composite(im, (x, y))
    if show_bounds:
        d = ImageDraw.Draw(out)
        bx, by, bw, bh = box(lay['bounds'])
        d.rectangle([bx, by, bx + bw, by + bh], outline=(255, 0, 80, 255))
        if pad_frame is not None:
            p = round(pad_frame * size)
            d.rectangle([p, p, size - p, size - p], outline=(0, 160, 255, 255))
    return out
