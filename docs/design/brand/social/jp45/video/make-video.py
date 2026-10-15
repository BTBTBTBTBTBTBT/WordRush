# JP-plan reels: raw simulator recordings (or code-rendered cast frames) -> 1080x1920 H.264 series template.
#
#   python3 docs/design/brand/social/jp45/video/make-video.py <job.json | slug ...>
#
# A job = {date, slug, post_title, season, captions:[[text,t0,t1],...], clips:[{file, ss, t, fit}], endcard: true,
#          notes}. `jobs.json` next to this file holds every job; the raw recordings live in a scratch folder
# (RAW env var, default ./raw) and are deleted once the final is cut. Needs ffmpeg + Pillow.
#
# Template (STYLE.md look, reel proportions): kit sky (standard) or the shipped Halloween wall behind everything,
# the real WORDOCIOUS wordmark top center, the app screen in a rounded window, ONE caption under it (Nunito Black,
# white with a purple stroke), @playwordocious footer. A 1.5 s end card closes it: wordmark + "Free on web, iOS and
# Android" + the handle. 30 fps, 1080x1920, H.264, no audio track unless the clip has one.
import json, os, subprocess, sys, shutil
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SOCIAL = os.path.dirname(os.path.dirname(HERE))
JP = os.path.dirname(HERE)
sys.path.insert(0, SOCIAL)
import kit
from kit import font, hex2rgb

BRAND = kit.BRAND
W, H = 1080, 1920
WIN_W, WIN_H = 690, 1500           # the app window (iPhone 17 is 1206x2622 -> 0.46)
WIN_X, WIN_Y = (W - WIN_W) // 2, 205
OUT = HERE
TMP = os.environ.get('VTMP', os.path.join(HERE, '_tmp'))
HANDLE = '@playwordocious'
PURPLE = (92, 40, 160)


def trim(im):
    bb = im.getchannel('A').getbbox()
    return im.crop(bb) if bb else im


def wordmark(width):
    wm = trim(Image.open(os.path.join(SOCIAL, 'wordmark-keyed.png')).convert('RGBA'))
    return wm.resize((width, round(wm.height * width / wm.width)), Image.LANCZOS)


def with_halo(canvas, wmi, x, y):
    halo = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    hm = Image.new('L', canvas.size, 0)
    hm.paste(wmi.getchannel('A').filter(ImageFilter.MaxFilter(13)), (x, y))
    halo.paste(Image.new('RGBA', canvas.size, (255, 244, 255, 255)), (0, 0),
               hm.filter(ImageFilter.GaussianBlur(wmi.height * 0.22)).point(lambda v: min(255, int(v * 0.9))))
    canvas.alpha_composite(halo)
    sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer = Image.new('RGBA', wmi.size, (40, 10, 80, 255)); layer.putalpha(wmi.getchannel('A').point(lambda v: int(v * 150 / 255)))
    sh.alpha_composite(layer, (x, y + round(wmi.height * 0.08)))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(wmi.height * 0.05)))
    canvas.alpha_composite(wmi, (x, y))


def background(season):
    if season in ('halloween', 'thanksgiving'):
        wall = Image.open(os.path.join(BRAND, 'seasons', season, 'walls', 'wall-home-wide.webp')).convert('RGBA')
        # a 9:16 slice of the shipped wall (the wide wall is 2400x1500)
        cw = round(1500 * 9 / 16)
        x0 = 1500
        c = wall.crop((x0, 0, x0 + cw, 1500)).resize((W, H), Image.LANCZOS)
        cols = ['#F0782C', '#8B2CF5', '#FF9F1A', '#9B3DF3'] if season == 'halloween' else ['#C0562A', '#E8A33A', '#7A2E4A', '#8B6B3A']
    else:
        c = kit.sky(W, H, seed=7)
        cols = None
    old = kit.TILE_COLORS
    if cols:
        kit.TILE_COLORS = cols
    kit.scatter_tiles(c, list('WORDOCIOUS'), seed=11, count=8, max_size=0.1,
                      keep_clear=[(0.12, 0.09, 0.88, 0.9)])
    kit.TILE_COLORS = old
    return c


def rr(w, h, r, ss=3):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), r * ss, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def frame_png(season, path, window=True):
    c = background(season)
    wmi = wordmark(470)
    with_halo(c, wmi, (W - wmi.width) // 2, 62)
    if not window:
        kit.text(c, HANDLE + '  .  wordocious.com', W // 2, 1868, 34, fill=(255, 255, 255), stroke=PURPLE, sw=3, weight='ExtraBold')
        c.convert('RGB').save(path)
        return
    # window frame: soft shadow + a thin white edge, the screen itself is overlaid by ffmpeg
    sh = Image.new('RGBA', c.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((WIN_X - 6, WIN_Y + 10, WIN_X + WIN_W + 6, WIN_Y + WIN_H + 26), 62, fill=(30, 8, 70, 150))
    c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    ring = Image.new('RGBA', c.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle((WIN_X - 7, WIN_Y - 7, WIN_X + WIN_W + 7, WIN_Y + WIN_H + 7), 60, fill=(255, 255, 255, 235))
    c.alpha_composite(ring)
    kit.text(c, HANDLE + '  .  wordocious.com', W // 2, 1868, 34, fill=(255, 255, 255), stroke=PURPLE, sw=3, weight='ExtraBold')
    c.convert('RGB').save(path)
    # the window mask (rounded screen)
    rr(WIN_W, WIN_H, 54).save(path.replace('.png', '-mask.png'))


def caption_png(text, path):
    """One caption, wrapped to two lines max, centered under the window."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    size = 60
    f = font(size, 'Black')
    d = ImageDraw.Draw(im)
    words = text.split()
    maxw = W - 150
    if d.textlength(text, font=f) <= maxw:
        lines = [text]
    else:   # two balanced lines (never an orphan word)
        best = None
        for i in range(1, len(words)):
            l1, l2 = ' '.join(words[:i]), ' '.join(words[i:])
            w = max(d.textlength(l1, font=f), d.textlength(l2, font=f))
            if best is None or w < best[0]: best = (w, [l1, l2])
        lines = best[1]
        if best[0] > maxw:      # still too wide: shrink the type
            size = round(60 * maxw / best[0]); f = font(size, 'Black')
    y = 1718 if len(lines) == 1 else 1698
    for ln in lines:
        kit.text(im, ln, W // 2, y + 30, size, fill=(255, 255, 255), stroke=PURPLE, sw=7, weight='Black')
        y += 74
    im.save(path)


def endcard_png(season, path):
    c = background(season)
    wmi = wordmark(820)
    with_halo(c, wmi, (W - wmi.width) // 2, 640)
    kit.text(c, 'Free on web, iOS and Android', W // 2, 1000, 56, fill=(255, 255, 255), stroke=PURPLE, sw=7, weight='Black')
    kit.text(c, HANDLE, W // 2, 1100, 64, fill=(255, 224, 120), stroke=PURPLE, sw=7, weight='Black')
    kit.text(c, 'wordocious.com', W // 2, 1190, 42, fill=(255, 255, 255), stroke=PURPLE, sw=5, weight='ExtraBold')
    c.convert('RGB').save(path)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(' '.join(cmd)[:400]); print(r.stderr[-1500:]); raise SystemExit(1)
    return r


def probe_seconds(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(r.stdout.strip())


def make(job, raw_dir):
    os.makedirs(TMP, exist_ok=True)
    slug = f"{job['date']}-{job['slug']}"
    season = job.get('season', 'standard')
    fpng = os.path.join(TMP, f'frame-{season}.png')
    if not os.path.exists(fpng):
        frame_png(season, fpng)
    end_png = os.path.join(TMP, f'end-{season}.png')
    if not os.path.exists(end_png):
        endcard_png(season, end_png)
    caps = job.get('captions', [])
    cap_pngs = []
    for i, (t, a, b) in enumerate(caps):
        p = os.path.join(TMP, f'{slug}-cap{i}.png'); caption_png(t, p); cap_pngs.append((p, a, b))

    # 1. normalize + concat the clips (screen only), cropped/scaled to the window
    inputs, fparts = [], []
    for i, cl in enumerate(job['clips']):
        src = cl['file'] if os.path.isabs(cl['file']) else os.path.join(raw_dir, cl['file'])
        inputs += ['-ss', str(cl.get('ss', 0)), '-t', str(cl['t']), '-i', src]
        sp = cl.get('speed', 1)
        fparts.append(f"[{i}:v]setpts=PTS/{sp},fps=30,scale={WIN_W}:{WIN_H}:flags=lanczos,setsar=1,format=yuv420p[c{i}]")
    n = len(job['clips'])
    fparts.append(''.join(f'[c{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[scr]')
    body = os.path.join(TMP, slug + '-body.mp4')
    # 2. overlay on the frame, mask corners, captions
    k = n
    inputs += ['-loop', '1', '-i', fpng, '-i', fpng.replace('.png', '-mask.png')]
    fparts.append(f'[{k+1}:v]format=gray[mk]')
    fparts.append(f'[scr]format=yuva420p[sv];[sv][mk]alphamerge[scm]')
    fparts.append(f'[{k}:v]fps=30[bg];[bg][scm]overlay={WIN_X}:{WIN_Y}:shortest=1[b0]')
    last = 'b0'
    for j, (p, a, b) in enumerate(cap_pngs):
        idx = k + 2 + j
        inputs += ['-loop', '1', '-i', p]
        fparts.append(f"[{idx}:v]format=rgba,fade=t=in:st={a}:d=0.3:alpha=1[cp{j}]")
        fparts.append(f"[{last}][cp{j}]overlay=0:0:shortest=1:enable='between(t,{a},{b})'[b{j+1}]")
        last = f'b{j+1}'
    fparts.append(f'[{last}]format=yuv420p[out]')
    total = sum(c['t'] / c.get('speed', 1) for c in job['clips'])
    run(['ffmpeg', '-y', '-v', 'error'] + inputs + ['-filter_complex', ';'.join(fparts), '-map', '[out]', '-t', f'{total:.2f}',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', body])
    return finish(job, body, slug, season, end_png)


def finish(job, body, slug, season, end_png=None):
    """Append the 1.5 s end card to a finished 1080x1920 body, cut the cover, return the manifest row."""
    end_png = end_png or os.path.join(TMP, f'end-{season}.png')
    if not os.path.exists(end_png):
        endcard_png(season, end_png)
    final = os.path.join(OUT, slug + '.mp4')
    if job.get('endcard', True):
        run(['ffmpeg', '-y', '-v', 'error', '-i', body, '-loop', '1', '-t', '1.5', '-i', end_png, '-filter_complex',
             '[1:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.2[e];[0:v][e]concat=n=2:v=1:a=0[o]', '-map', '[o]',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', final])
    else:
        shutil.copy(body, final)
    secs = probe_seconds(final)
    # cover frame: ~1.2 s in (the app mid-action, caption up)
    cover = os.path.join(OUT, slug + '-cover.jpg')
    run(['ffmpeg', '-y', '-v', 'error', '-ss', str(job.get('cover_at', min(3.0, secs / 2))), '-i', final, '-frames:v', '1', '-q:v', '2', cover])
    return {'date': job['date'], 'post_title': job['post_title'], 'file': os.path.relpath(final, JP),
            'cover': os.path.relpath(cover, JP), 'seconds': round(secs, 1), 'notes': job.get('notes', '')}


def main():
    jobs = json.load(open(os.path.join(HERE, 'jobs.json')))
    raw_dir = os.environ.get('RAW', os.path.join(HERE, 'raw'))
    want = sys.argv[1:]
    mpath = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else []
    for job in jobs:
        key = f"{job['date']}-{job['slug']}"
        if want and key not in want and job['slug'] not in want and job['date'] not in want:
            continue
        print('make', key, flush=True)
        entry = make(job, raw_dir)
        manifest = [m for m in manifest if m['date'] != entry['date'] or m['post_title'] != entry['post_title']] + [entry]
    manifest.sort(key=lambda m: m['date'])
    json.dump(manifest, open(mpath, 'w'), indent=1)


if __name__ == '__main__':
    main()
