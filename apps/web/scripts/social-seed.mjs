#!/usr/bin/env node
// Social Studio: compose the seed posts' images from SHIPPED art (no image generation) and write the seed SQL.
//
//   node apps/web/scripts/social-seed.mjs
//
// Reads lib/admin/studio-seed.json. Writes, per post and size:
//   public/social/seed/<kind>-<portrait|pin|landscape>.jpg   (1080x1350 IG/FB/Threads, 1000x1500 Pinterest, 1600x900 X)
// and docs/sql/20261005-social-studio-seed.sql (posts, targets, tracked links; idempotent).
// Text is drawn with the system "Avenir Next" (macOS); run it on a Mac.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(WEB, 'public/social/seed');
const SQL = join(WEB, '../../docs/sql/20261005-social-studio-seed.sql');
const seed = JSON.parse(readFileSync(join(WEB, 'lib/admin/studio-seed.json'), 'utf8'));

const SIZES = { portrait: [1080, 1350], pin: [1000, 1500], landscape: [1600, 900] };
const CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'];
const FONT = 'Avenir Next';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function textSvg(w, h, items) {
  const body = items.map((t) => {
    const lines = Array.isArray(t.text) ? t.text : [t.text];
    return lines.map((line, i) => `<text x="${t.x}" y="${t.y + i * (t.lh ?? t.size * 1.2)}" text-anchor="${t.anchor ?? 'middle'}" font-family="${FONT}" font-weight="${t.weight ?? 800}" font-size="${t.size}" fill="${t.fill ?? '#fff'}"${t.spacing ? ` letter-spacing="${t.spacing}"` : ''}>${esc(line)}</text>`).join('');
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
}

function bgSvg(w, h, top, bottom, glow = 'rgba(255,255,255,0.10)') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
      <radialGradient id="r" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/></svg>`);
}

async function art(file, size) {
  return sharp(join(WEB, 'public', file)).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** Footer: wordocious.com pill. */
function footer(w, h, s, dark = false) {
  const pw = 360 * s, ph = 64 * s, x = (w - pw) / 2, y = h - ph - 46 * s;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${dark ? '#f59e0b' : '#ffffff'}"/>
    <text x="${w / 2}" y="${y + ph * 0.66}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${30 * s}" fill="${dark ? '#1c1033' : '#5b21b6'}">wordocious.com</text></svg>`);
}

async function castRows(w, h, s, files, top, cell, cols = 5) {
  const out = [];
  const rows = Math.ceil(files.length / cols);
  for (let r = 0; r < rows; r++) {
    const row = files.slice(r * cols, r * cols + cols);
    const rowW = row.length * cell;
    const x0 = Math.round((w - rowW) / 2);
    for (let i = 0; i < row.length; i++) {
      out.push({ input: await art(row[i], Math.round(cell * 0.96)), left: x0 + i * cell, top: Math.round(top + r * cell * 1.02) });
    }
  }
  return out;
}

const TEMPLATES = {
  async cast(post, w, h) {
    const s = Math.min(w / 1080, h / 1350) * (h < w ? 1.15 : 1);
    const land = h < w;
    const layers = [];
    const cell = land ? 165 : Math.round(w / 5.1);
    const castTop = land ? 300 : Math.round(h * 0.33);
    layers.push(...await castRows(w, h, s, CAST.map((c) => `mascots/${c}.png`), castTop, cell));
    layers.push({ input: textSvg(w, h, [{ text: "Who's your favorite?", x: w / 2, y: castTop + 2 * cell * 1.02 + (land ? 70 : 90 * (w / 1080)), size: land ? 44 : 50 * (w / 1080), weight: 700 }]), left: 0, top: 0 });
    layers.push({ input: textSvg(w, h, [
      { text: 'Meet the cast', x: w / 2, y: land ? 150 : h * 0.17, size: (land ? 96 : 104) * (w / 1080 > 1 ? 1 : w / 1080) },
      { text: 'Ten letters. Ten friends.', x: w / 2, y: land ? 230 : h * 0.17 + 92, size: land ? 44 : 46 * (w / 1080), fill: '#fde68a', weight: 700 },
    ]), left: 0, top: 0 });
    layers.push({ input: footer(w, h, land ? 0.9 : w / 1080), left: 0, top: 0 });
    return sharp(bgSvg(w, h, '#7c3aed', '#4c1d95')).composite(layers);
  },

  async teaser(post, w, h) {
    const land = h < w;
    const { guesses, answer } = post.puzzle;
    const tile = land ? 112 : Math.round(w * 0.135);
    const gap = Math.round(tile * 0.1);
    const gridW = 5 * tile + 4 * gap;
    const gx = land ? 170 : Math.round((w - gridW) / 2);
    const gy = land ? 250 : Math.round(h * 0.29);
    const colors = { correct: '#7c3aed', present: '#f59e0b', absent: '#9ca3af' };
    const score = (g) => g.split('').map((ch, i) => (answer[i] === ch ? 'correct' : answer.includes(ch) ? 'present' : 'absent'));
    let tiles = '';
    const rows = [...guesses, null];
    rows.forEach((g, r) => {
      const marks = g ? score(g) : null;
      for (let i = 0; i < 5; i++) {
        const x = gx + i * (tile + gap), y = gy + r * (tile + gap);
        if (g) {
          tiles += `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${tile * 0.16}" fill="${colors[marks[i]]}"/>`;
          tiles += `<text x="${x + tile / 2}" y="${y + tile * 0.68}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${tile * 0.52}" fill="#fff">${g[i]}</text>`;
        } else {
          tiles += `<rect x="${x + 2}" y="${y + 2}" width="${tile - 4}" height="${tile - 4}" rx="${tile * 0.16}" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.55)" stroke-width="4"/>`;
          tiles += `<text x="${x + tile / 2}" y="${y + tile * 0.68}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${tile * 0.5}" fill="#fde68a">?</text>`;
        }
      }
    });
    const grid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${tiles}</svg>`);
    const layers = [{ input: grid, left: 0, top: 0 }];
    const hostSize = land ? 420 : Math.round(w * 0.36);
    layers.push({ input: await art('mascots/c.png', hostSize), left: land ? w - hostSize - 120 : Math.round(w - hostSize - w * 0.04), top: land ? 250 : Math.round(gy + 3 * (tile + gap) + h * 0.015) });
    layers.push({ input: textSvg(w, h, land ? [
      { text: 'Can you solve it?', x: 170, y: 160, size: 92, anchor: 'start' },
      { text: 'Four letters locked in. One to go.', x: 170, y: 250 + 3 * (tile + gap) + 70, size: 40, anchor: 'start', fill: '#fde68a', weight: 700 },
    ] : [
      { text: 'Can you solve it?', x: w / 2, y: h * 0.16, size: 92 * (w / 1080) },
      { text: 'Four letters locked in. One to go.', x: w / 2, y: h * 0.16 + 78 * (w / 1080), size: 40 * (w / 1080), fill: '#fde68a', weight: 700 },
      { text: ['Purple: right spot', 'Gold: right letter,', 'wrong spot'], x: w * 0.07, y: gy + 3 * (tile + gap) + h * 0.07, size: 36 * (w / 1080), anchor: 'start', weight: 700, fill: '#ede9fe' },
    ]), left: 0, top: 0 });
    layers.push({ input: footer(w, h, land ? 0.9 : w / 1080), left: 0, top: 0 });
    return sharp(bgSvg(w, h, '#3b0764', '#1e1b4b', 'rgba(167,139,250,0.22)')).composite(layers);
  },

  async wotd(post, w, h) {
    const land = h < w;
    const { word, pos, short } = post.wotd;
    const titleW = land ? 760 : Math.round(w * 0.86);
    const title = await sharp(join(WEB, 'public/art/art-titlecast-wotd.webp')).resize({ width: titleW }).png().toBuffer();
    const tmeta = await sharp(title).metadata();
    const layers = [{ input: title, left: land ? 90 : Math.round((w - titleW) / 2), top: land ? 90 : Math.round(h * 0.07) }];
    const hostSize = land ? 470 : Math.round(w * 0.42);
    layers.push({ input: await art('mascots/i.png', hostSize), left: land ? w - hostSize - 110 : Math.round((w - hostSize) / 2), top: land ? 230 : Math.round(h * 0.56) });
    const def = wrap(short, land ? 30 : 34);
    const wy = land ? 90 + tmeta.height + 150 : Math.round(h * 0.07 + tmeta.height + h * 0.14);
    const sc = land ? 1 : w / 1080;
    layers.push({ input: textSvg(w, h, [
      { text: word, x: land ? 110 : w / 2, y: wy, size: 150 * sc, anchor: land ? 'start' : 'middle', spacing: 10 * sc },
      { text: pos, x: land ? 116 : w / 2, y: wy + 66 * sc, size: 40 * sc, anchor: land ? 'start' : 'middle', fill: '#fde68a', weight: 700 },
      { text: def, x: land ? 110 : w / 2, y: wy + 140 * sc, size: 44 * sc, anchor: land ? 'start' : 'middle', weight: 600, fill: '#f5f3ff', lh: 56 * sc },
    ]), left: 0, top: 0 });
    layers.push({ input: footer(w, h, land ? 0.9 : w / 1080), left: 0, top: 0 });
    return sharp(bgSvg(w, h, '#6d28d9', '#3b0764')).composite(layers);
  },

  async season(post, w, h) {
    const land = h < w;
    const cell = land ? 150 : Math.round(w / 5.6);
    const castTop = land ? 330 : Math.round(h * 0.41);
    const layers = [...await castRows(w, h, 1, CAST.map((c) => `art/art-halloween-${c}.webp`), castTop, cell)];
    const prop = land ? 150 : Math.round(w * 0.16);
    const props = [
      ['pumpkin', land ? 60 : 40, land ? 40 : Math.round(h * 0.03)],
      ['bat', land ? w - prop - 60 : w - prop - 40, land ? 40 : Math.round(h * 0.035)],
      ['ghost', land ? 40 : 30, land ? h - prop - 140 : Math.round(h * 0.76)],
      ['candy', land ? w - prop - 40 : w - prop - 30, land ? h - prop - 140 : Math.round(h * 0.76)],
    ];
    for (const [name, x, y] of props) layers.push({ input: await art(`art/art-halloween-prop-${name}.webp`, prop), left: x, top: y });
    const sc = land ? 1 : w / 1080;
    layers.push({ input: textSvg(w, h, [
      { text: 'Something spooky', x: w / 2, y: land ? 150 : h * 0.235, size: 90 * sc, fill: '#fb923c' },
      { text: 'is coming', x: w / 2, y: (land ? 150 : h * 0.235) + 96 * sc, size: 90 * sc },
      { text: 'Oct 17 – Nov 1', x: w / 2, y: land ? castTop + 2 * cell * 1.02 + 60 : castTop + 2 * cell * 1.02 + 70 * sc, size: 48 * sc, fill: '#fde68a', weight: 700 },
    ]), left: 0, top: 0 });
    layers.push({ input: footer(w, h, land ? 0.9 : sc, true), left: 0, top: 0 });
    return sharp(bgSvg(w, h, '#1c1033', '#0b0614', 'rgba(251,146,60,0.18)')).composite(layers);
  },
};

mkdirSync(OUT, { recursive: true });
const PLATFORM_SIZE = { instagram: 'portrait', facebook: 'portrait', threads: 'portrait', tiktok: 'portrait', pinterest: 'pin', x: 'landscape' };
const sql = [
  '-- Social Studio seed: the first week of drafts (generated by apps/web/scripts/social-seed.mjs; idempotent).',
  '-- Images are composed from shipped art into apps/web/public/social/seed/ (served at wordocious.com/social/seed/).',
  'begin;',
];
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

for (const post of seed.posts) {
  const media = [];
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const img = await TEMPLATES[post.kind](post, w, h);
    const file = `${post.kind}-${size}.jpg`;
    await img.flatten({ background: '#000' }).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, file));
    media.push({ size, src: 'public', path: `/social/seed/${file}`, width: w, height: h });
  }
  const at = `${post.day} ${post.time}:00 America/Chicago`;
  sql.push(`insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, created_by)
values (${q(post.id)}, ${q(post.title)}, ${q(post.kind)}, ${q(at)}::timestamptz, ${q(`{${post.hashtags.join(',')}}`)}::text[], ${q(JSON.stringify(media))}::jsonb, ${q(post.link_target)}, 'claude')
on conflict (id) do nothing;`);
  for (const [platform, caption] of Object.entries(post.captions)) {
    const slug = `p-${post.id.replace(/-/g, '').slice(-8)}-${platform}`;
    sql.push(`insert into public.marketing_links (slug, target, channel) values (${q(slug)}, ${q(post.link_target)}, ${q(platform)}) on conflict (slug) do nothing;`);
    sql.push(`insert into public.social_post_targets (post_id, platform, caption, link_slug) values (${q(post.id)}, ${q(platform)}, ${q(caption)}, ${q(slug)}) on conflict (post_id, platform) do nothing;`);
  }
  void PLATFORM_SIZE;
}
sql.push('commit;', '');
writeFileSync(SQL, sql.join('\n'));
console.log(`wrote ${seed.posts.length * 3} images to ${OUT} and ${SQL}`);
