// Contact sheets for the body rigs (docs/cloud-prompts/06): every body × every pose (with a few items), drawn by the
// SHIPPED web renderer (lib/avatar-render mascotSvg), plus living-mascot frame strips (idle, tap, reactions).
// Writes HTML into docs/design/brand/avatar/rigs/sheets/; docs/design/brand/avatar/rigs/shoot.py screenshots them.
//   apps/server/node_modules/.bin/tsx apps/web/scripts/pose-sheets.ts
import * as fs from 'fs';
import { join } from 'path';
import { AVATAR_BODIES, AVATAR_POSES, avatarLiveFrame, castPreset, validateAvatar, type AvatarConfig, type AvatarReaction } from '@wordle-duel/core';
import { avatarArtNames, avatarLiveLayout, mascotSvg, withAvatarId } from '../lib/avatar-render';

const repo = join(__dirname, '..', '..', '..');
const ART = join(repo, 'apps/web/public/art');
const OUT = join(repo, 'docs/design/brand/avatar/rigs/sheets');
fs.mkdirSync(OUT, { recursive: true });
const artSrc = (n: string) => `file://${ART}/${n}.webp`;
const art = new Set(fs.readdirSync(ART).filter((f) => f.startsWith('art-av-')).map((f) => f.replace(/\.webp$/, '')));
const LOOKS: Array<Record<string, string>> = [
  { held: 'mug', feet: 'sneakers', head: 'cowboy', color: 'purple' },
  { held: 'balloon', neck: 'scarf', head: 'crown', color: 'sky' },
  { held: 'book', neck: 'backpack', head: 'beanie', feet: 'boots', color: 'green', accColor: 'orange' },
  { held: 'trophy', wrap: 'belt', head: 'party', pet: 'kitten', color: 'pink' },
];
let n = 0;
const svg = (config: AvatarConfig, opts: Partial<Parameters<typeof mascotSvg>[0]>, size = 150) => {
  const missing = (opts.live ? avatarLiveLayout(config, false).layers.map((l) => l.art) : avatarArtNames(config)).filter((a) => !art.has(a));
  const s = withAvatarId(mascotSvg({ config, initial: 'A', size, art, crownSrc: '', artSrc, ...opts }), `m${n++}`);
  return `<div class="c" style="width:${size}px;height:${size}px">${s}${missing.length ? `<b>${missing.join(' ')}</b>` : ''}</div>`;
};
const page = (title: string, body: string) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#2b2846;font:700 12px system-ui;color:#eee}.r{display:flex;align-items:center;gap:4px;padding:2px 6px}
.c{position:relative;background:#f6f2ff;border-radius:12px;overflow:hidden}.c b{position:absolute;left:0;top:0;color:red;font-size:9px}
.l{width:70px}h3{margin:6px}</style><h3>${title}</h3>${body}`;
const base = castPreset('w');
const mk = (o: Record<string, string>) => validateAvatar({ ...base, eyes: 'beady', mouth: 'smile', ...o }, base);

// 1. every body × every pose, a look per body (static pose frames, the path widgets / shares / boards draw)
for (const half of [0, 1]) {
  const bodies = AVATAR_BODIES.slice(half * 6, half * 6 + 6);
  let rows = `<div class="r"><span class="l"></span>${AVATAR_POSES.map((p) => `<span style="width:150px;text-align:center">${p}</span>`).join('')}</div>`;
  for (const [i, body] of bodies.entries()) {
    const look = LOOKS[(i + half * 2) % LOOKS.length];
    rows += `<div class="r"><span class="l">${body}</span>${AVATAR_POSES.map((pose) => svg(mk({ body, ...look, pose }), { pose: 'saved', size: 150 })).join('')}</div>`;
  }
  fs.writeFileSync(join(OUT, `poses-${half + 1}.html`), page(`Body rigs × poses (${half ? 'B' : 'A'}) — shipped web renderer, static pose frames`, rows));
}
// 2. bare bodies × poses (white + a gradient Pro color), so the cut seams are easy to see
{
  let rows = '';
  for (const body of AVATAR_BODIES) {
    rows += `<div class="r"><span class="l">${body}</span>${AVATAR_POSES.map((pose) => svg(mk({ body, pose, color: body.length % 2 ? 'white' : 'holo', eyes: 'none', mouth: 'none' }), { pose: 'saved', size: 110 }, 110)).join('')}</div>`;
  }
  fs.writeFileSync(join(OUT, 'bare.html'), page('Bare bodies × poses (seams)', rows));
}
// 3. living-mascot frame strips: idle (breathe + blink + the pose's own motion), tap (hop + laugh), reactions
{
  const strip = (label: string, config: AvatarConfig, frames: Array<Parameters<typeof avatarLiveFrame>[0]>) =>
    `<div class="r"><span class="l">${label}</span>${frames.map((f) => svg(config, { live: true, liveFrame: avatarLiveFrame(f) }, 120)).join('')}</div>`;
  let rows = '';
  const ts = Array.from({ length: 10 }, (_, k) => k * 0.16);
  for (const [body, pose, look] of [['classic', 'wave', LOOKS[0]], ['star', 'none', LOOKS[1]], ['bean', 'hips', LOOKS[3]]] as const) {
    const c = mk({ body, pose, ...look });
    rows += strip(`${body} idle`, c, ts.map((t) => ({ pose, t: 1.2 + t * 1.5 })));
    rows += strip(`${body} tap`, c, ts.map((t) => ({ pose, t: 3, tap: t * 0.75 })));
  }
  const c = mk({ body: 'mini', ...LOOKS[2] });
  for (const kind of ['win', 'loss', 'streak', 'levelup'] as AvatarReaction[]) rows += strip(`mini ${kind}`, c, ts.map((t) => ({ pose: 'none', t: 2, reaction: { kind, t: t * 1.6 } })));
  rows += strip('reduce motion tap', c, ts.map((t) => ({ pose: 'none', t: 2, tap: t * 0.75, still: true })));
  fs.writeFileSync(join(OUT, 'frames.html'), page('Living mascot frames (web renderer): idle 0.24 s apart, tap 0.12 s apart, reactions 0.26 s apart', rows));
}
console.log('wrote', OUT);
