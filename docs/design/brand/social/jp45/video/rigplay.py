# Headless port of docs/design/brand/animation/rig-engine/player.js: draws a cast rig (layers cut from the APPROVED
# hero art, nothing redrawn) at any time t / tap time, into an RGBA numpy image. Used for the cast-led reels
# (founder 10-14: "animate the REAL cast art in code"). Same tracks, easings, breath, blink schedule, tap hop + laugh.
import json, math, os
import numpy as np
import cv2
from PIL import Image

ANIM = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'animation'))
STAGE = dict(w=1300, h=1160, heroX=138, heroY=100)


def _in(x): return x * x
def _out(x): return 1 - (1 - x) ** 2
def _inout(x): return 2 * x * x if x < .5 else 1 - (-2 * x + 2) ** 2 / 2
def _back(c):
    return lambda x: 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
EASE = {'linear': lambda x: x, 'in': _in, 'out': _out, 'inOut': _inout, 'sine': lambda x: .5 - .5 * math.cos(math.pi * x),
        'inCubic': lambda x: x ** 3, 'outCubic': lambda x: 1 - (1 - x) ** 3, 'outBack': _back(1.4), 'outBackSoft': _back(0.9),
        'step': lambda x: 0 if x < 1 else 1}


def kf_val(kf, t):
    if t <= kf[0][0]: return kf[0][1]
    for i in range(1, len(kf)):
        if t < kf[i][0]:
            a, b = kf[i - 1], kf[i]
            p = (t - a[0]) / (b[0] - a[0])
            e = EASE.get(b[2] if len(b) > 2 and b[2] else 'inOut', _inout)
            return a[1] + (b[1] - a[1]) * e(p)
    return kf[-1][1]


def blink_times(seed, start):
    out, t, s = [], start, seed
    while t < 900:
        out.append(t); s = (s * 9301 + 49297) % 233280; t += 3 + 2 * (s / 233280)
    return out


class Rig:
    def __init__(self, cid):
        self.cid = cid
        d = os.path.join(ANIM, cid)
        self.r = json.load(open(os.path.join(d, 'rig.json')))
        self.stage = self.r.get('stage', STAGE)
        self.cycle = self.r.get('cycle', 6)
        self.hop = self.r.get('hop', 70)
        self.tracks = self.r.get('tracks', {})
        self.blinks = blink_times(self.r.get('blinkSeed', 7), self.r.get('blinkStart', 1.3))
        used = {L['img'] for L in self.r['layers']} | set(self.r.get('laugh', [])) | set((self.r.get('blink') or {}).values())
        self.img, self.box = {}, {}
        for n in used:
            im = Image.open(os.path.join(d, 'layers', n + '.png')).convert('RGBA')
            a = np.asarray(im).astype(np.float32) / 255.0
            a[..., :3] *= a[..., 3:4]          # premultiplied for clean warps
            self.img[n] = a
            self.box[n] = im.getchannel('A').getbbox() or (0, 0, im.width, im.height)

    # ---- values
    def track(self, name, t):
        tr = self.tracks.get(name)
        if not tr: return 0
        v = 0
        if 'kf' in tr:
            P = tr.get('period', self.cycle); o = tr.get('offset', 0)
            v += kf_val(tr['kf'], ((t - o) % P + P) % P)
        if 'osc' in tr:
            osc = tr['osc']; amp, per = osc[0], osc[1]; t0 = osc[2] if len(osc) > 2 else 0; bounce = osc[3] if len(osc) > 3 else 0
            o = -abs(amp * math.sin(math.pi * (t - t0) / per)) if bounce else amp * math.sin(2 * math.pi * (t - t0) / per)
            if 'env' in tr: o *= kf_val(tr['env'], ((t % self.cycle) + self.cycle) % self.cycle)
            v += o
        return v

    def val(self, spec, t, dflt):
        if spec is None: return dflt
        if isinstance(spec, (int, float)): return spec
        if isinstance(spec, str): return self.track(spec, t)
        return sum(self.val(x, t, 0) for x in spec)

    def blink_state(self, t):
        for b in self.blinks:
            if b > t: break
            d = t - b
            if d < 0.16: return 'half' if (d < 0.04 or d > 0.12) else 'closed'
        return None

    # ---- drawing
    @staticmethod
    def _m(tx=0, ty=0, rot=0, sx=1, sy=1):
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        return np.array([[c * sx, -s * sy, tx], [s * sx, c * sy, ty], [0, 0, 1]], np.float64)

    def _warp(self, out, name, M, alpha=1.0, ripple=None, t=0):
        src = self.img[name]
        if ripple:
            x0, y0, x1, y1 = self.box[name]
            src = src.copy()
            for y in range(y0, y1):
                f = min(1, max(0, (y - ripple['top']) / (ripple['hem'] - ripple['top'])))
                d = ripple['amp'] * (f ** 1.6) * math.sin(t / ripple['period'] * math.pi * 2 - y / 60)
                if abs(d) > 0.01:
                    row = src[y:y + 1]
                    mx = (np.arange(src.shape[1], dtype=np.float32) - d)[None, :]
                    my = np.zeros_like(mx)
                    src[y:y + 1] = cv2.remap(row, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        w = cv2.warpAffine(src, M[:2], (out.shape[1], out.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        out[:] = w * alpha + out * (1 - w[..., 3:4] * alpha)

    def render(self, t, tap=None, k=1.0):
        S = self.stage
        W, H = round(S['w'] * k), round(S['h'] * k)
        out = np.zeros((H, W, 4), np.float32)
        hop = sq = 0.0
        laugh = False
        if tap is not None and 0 <= tap < 0.95:
            laugh = True
            if tap < 0.08: sq = -0.05 * math.sin(tap / 0.08 * math.pi / 2)
            elif tap < 0.48:
                p = (tap - 0.08) / 0.4; hop = -self.hop * math.sin(p * math.pi); sq = 0.03 * math.sin(p * math.pi)
            elif tap < 0.62: sq = -0.04 * math.sin((tap - 0.48) / 0.14 * math.pi)
        K = self._m(0, 0, 0, k, k)
        base = K @ self._m(S['heroX'], S['heroY'])
        # ground shadow layers stay on the floor
        for L in self.r['layers']:
            if L.get('shadow'):
                f = min(1, max(0, -hop / self.hop)); g = min(1.2, max(0.5, 1 - 0.35 * f))
                x0, y0, x1, y1 = self.box[L['img']]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                M = base @ self._m(cx, cy, 0, g, g) @ self._m(-cx, -cy)
                self._warp(out, L['img'], M, 1 - 0.45 * f)
        B = self.r.get('breath') or {'origin': [512, 960], 'period': 3.4, 'sy': 0.012, 'sx': 0.006}
        br = math.sin(t / B['period'] * math.pi * 2)
        sy = 1 + B['sy'] * br + sq; sx = 1 - B['sx'] * br - sq * 0.6
        RT = self.r.get('root') or {}
        o = RT.get('origin', B['origin'])
        rdx, rdy = self.val(RT.get('dx'), t, 0), self.val(RT.get('dy'), t, 0)
        rrot = self.val(RT.get('rot'), t, 0)
        rsx, rsy = self.val(RT.get('sx'), t, 1), self.val(RT.get('sy'), t, 1)
        root = base @ self._m(rdx, rdy + hop) @ self._m(o[0], o[1], rrot, sx * rsx, sy * rsy) @ self._m(-o[0], -o[1])

        def patches():
            if laugh:
                for p in self.r.get('laugh', []): self._warp(out, p, root)
                return
            if not self.r.get('blink'): return
            e = self.blink_state(t)
            if self.r.get('eyesTrack'):
                v = self.track(self.r['eyesTrack'], t)
                if v >= 1.5: e = 'closed'
                elif v >= 0.5 and e != 'closed': e = 'half'
            p = e and self.r['blink'].get(e)
            if p: self._warp(out, p, root)

        patched = False
        for L in self.r['layers']:
            if L.get('shadow'): continue
            if L.get('when') == 'laugh' and not laugh: continue
            if L.get('when') == 'nolaugh' and laugh: continue
            name = L['img']
            x0, y0 = self.box[name][:2]
            piv = L.get('pivot') or [x0, y0]
            at = L.get('at') or piv
            pin = L.get('pivotInImg') or piv
            rot = self.val(L.get('rot'), t, 0); dx = self.val(L.get('dx'), t, 0); dy = self.val(L.get('dy'), t, 0)
            s = self.val(L.get('s'), t, 1); lsx = self.val(L.get('sx'), t, 1) * s; lsy = self.val(L.get('sy'), t, 1) * s
            alpha = 1 if L.get('alpha') is None else min(1, max(0, self.val(L.get('alpha'), t, 1)))
            if alpha <= 0.002: continue
            rest = abs(rot) < 0.01 and abs(dx) < 0.05 and abs(dy) < 0.05 and abs(lsx - 1) < 1e-3 and abs(lsy - 1) < 1e-3
            if L.get('when') == 'active' and rest: continue
            M = root @ self._m(at[0] + dx, at[1] + dy, rot, lsx, lsy) @ self._m(-pin[0], -pin[1])
            self._warp(out, name, M, alpha, L.get('ripple'), t)
            if self.r.get('patchAfter') and name == self.r['patchAfter']:
                patches(); patched = True
        if not patched: patches()
        return out

    def to_pil(self, arr):
        a = arr.copy()
        al = a[..., 3:4]
        rgb = np.where(al > 1e-4, a[..., :3] / np.maximum(al, 1e-4), 0)
        return Image.fromarray((np.concatenate([rgb, al], 2).clip(0, 1) * 255).astype(np.uint8), 'RGBA')
