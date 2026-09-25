// Builds the founder's content-review pack for the four authored banks
// (Kindred, Codebreaker, Crosswordocious, Muddle) from the merged-bank review
// JSONs that merge-banks.mjs produces under scripts/out/more-games-samples/.
// Output: scripts/out/more-games-banks/{index,kindred,codebreaker,crosswordocious,muddle}.html
// plus one CSV per game with a `keep` column to mark vetoes.
//   node scripts/more-games/build-bank-review.mjs
import fs from 'node:fs';
import path from 'node:path';
import { REPO, SAMPLES, readJSON } from './lib.mjs';

const OUT = path.join(REPO, 'scripts', 'out', 'more-games-banks');
fs.mkdirSync(OUT, { recursive: true });
const J = (f) => (fs.existsSync(path.join(SAMPLES, f)) ? readJSON(path.join(SAMPLES, f)) : null);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (name, header, rows) => { fs.writeFileSync(path.join(OUT, name), [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'); return rows.length; };
const date = new Date().toISOString().slice(0, 10);

const CSS = `
:root{--bg:#f8f7ff;--surface:#fff;--border:#ede9f6;--border2:#e0daf0;--text:#1a1a2e;--muted:#6b7280;--faint:#9ca3af;--purple:#7c3aed;--tile:#fff;--th-bg:#ede9fe;--th-bd:#c4b5fd;--th-tx:#5b21b6;--wine:#9f1239;--umber:#92400e;--slate:#475569;--orange:#f97316;--g1:#ddd6fe;--g2:#a78bfa;--g3:#7c3aed;--g4:#1a1a2e;--g1t:#3b0764;--g2t:#1a1a2e;--g3t:#fff;--g4t:#fff;--lilac:#f5f3ff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1a1a2e;--surface:#252542;--border:#3a3a5c;--border2:#3a3a5c;--text:#f0eef6;--muted:#a0a0b8;--faint:#8b8ba7;--purple:#a78bfa;--tile:#2e2e4a;--th-bg:#3b2a6b;--th-bd:#6d4fc2;--th-tx:#ddd6fe;--g4:#0f0f1c;--g1t:#1a1a2e;--lilac:#2a2350}}
:root[data-theme="dark"]{--bg:#1a1a2e;--surface:#252542;--border:#3a3a5c;--border2:#3a3a5c;--text:#f0eef6;--muted:#a0a0b8;--faint:#8b8ba7;--purple:#a78bfa;--tile:#2e2e4a;--th-bg:#3b2a6b;--th-bd:#6d4fc2;--th-tx:#ddd6fe;--g4:#0f0f1c;--g1t:#1a1a2e;--lilac:#2a2350}
body{background:var(--bg);color:var(--text);font-family:'Nunito',system-ui,sans-serif;font-weight:600;font-size:15px;line-height:1.5;padding-inline:16px;padding-block:24px 64px;margin:0}
main{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
h1{font-weight:900;font-size:30px;margin:0;letter-spacing:.4px;text-wrap:balance}h2{font-weight:900;font-size:20px;margin:0}
.lede{max-width:70ch;color:var(--muted);margin:4px 0 0}.kick{font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint)}
nav{display:flex;flex-wrap:wrap;gap:8px}nav a{font-weight:800;font-size:13px;padding:6px 12px;border-radius:999px;border:1.5px solid var(--border2);color:var(--text);text-decoration:none;background:var(--surface)}nav a.cur{background:var(--purple);border-color:var(--purple);color:#fff}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.stat{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:12px 14px}.stat b{display:block;font-size:24px;font-weight:900;font-variant-numeric:tabular-nums}.stat span{font-size:12px;color:var(--faint);font-weight:800;letter-spacing:.6px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--surface);border:1.5px solid var(--border);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}.wide{grid-column:1/-1}
.meta{font-size:12px;color:var(--faint);font-weight:700}.ttl{font-weight:900;font-size:16px}.id{font-size:11px;color:var(--faint);font-weight:800;letter-spacing:.5px}
.row{display:inline-flex;gap:3px;flex-wrap:wrap}.t{width:26px;height:26px;border-radius:7px;border:2px solid var(--border2);background:var(--tile);display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
.t.on{background:var(--purple);border-color:var(--purple);color:#fff}.t.circ{box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px var(--purple)}.t.pun{background:var(--lilac);border-color:var(--th-bd);color:var(--th-tx)}.t.pun.circ{box-shadow:inset 0 0 0 2px var(--lilac),inset 0 0 0 4px var(--purple)}
.grp{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;border-radius:10px;padding:7px 10px;font-size:13px}.grp b{font-weight:900}.pips{font-size:8px;letter-spacing:2px}
.g1{background:var(--g1);color:var(--g1t)}.g2{background:var(--g2);color:var(--g2t)}.g3{background:var(--g3);color:var(--g3t)}.g4{background:var(--g4);color:var(--g4t)}
.tiles16{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.tiles16 span{background:var(--tile);border:1.5px solid var(--border2);border-radius:8px;padding:6px 2px;text-align:center;font-weight:900;font-size:11px;letter-spacing:.3px}
details summary{cursor:pointer;font-weight:800;font-size:13px;color:var(--purple)}
.cgram{display:flex;flex-wrap:wrap;gap:8px 12px}.cword{display:inline-flex;gap:2px;align-items:flex-end}.cl{display:inline-flex;flex-direction:column;align-items:center;width:17px}.cl b{width:100%;height:21px;border-bottom:2px solid var(--border2);font-weight:900;font-size:15px;text-align:center;line-height:20px}.cl.giv b{color:var(--purple);border-color:var(--purple)}.cl i{font-style:normal;font-size:10px;color:var(--faint);font-weight:800}.pn{align-self:flex-end;font-weight:900;padding-bottom:12px}
.plain{margin:4px 0 0;font-weight:800}
.cwwrap{display:flex;flex-direction:column;align-items:center;gap:18px;padding:6px 0 2px}.cw{display:grid;gap:3px;width:min(100%,400px)}.cw span{aspect-ratio:1;box-sizing:border-box;min-width:0}.cw .c{position:relative;border:1.5px solid var(--th-bd);background:var(--th-bg);color:var(--th-tx);border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:clamp(12px,3.4vw,16px);line-height:1}.cw i{position:absolute;top:2px;left:3px;font-style:normal;font-size:8px;font-weight:900;opacity:.75}
.clues{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;width:100%;max-width:700px}.clues h4{margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--faint)}.clues ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}.clues li{display:flex;gap:7px;font-size:12.5px;line-height:1.35}.nb{flex:none;min-width:20px;height:20px;border-radius:6px;background:var(--th-bg);color:var(--th-tx);border:1px solid var(--th-bd);font-weight:900;font-size:11px;display:inline-flex;align-items:center;justify-content:center}.ans{color:var(--purple);font-weight:900}
@media (max-width:520px){.clues{grid-template-columns:1fr}}
.mword{display:flex;flex-direction:column;gap:4px}.mscr{font-weight:900;letter-spacing:5px;font-size:15px}.cap{font-weight:800;margin:0}.scene{color:var(--muted);font-size:13px;margin:0}
table td,table th{padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top}
.warn{background:#fff7ed;border:1.5px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 14px;font-size:13px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .warn{background:#431407;border-color:#9a3412;color:#fed7aa}}
:root[data-theme="dark"] .warn{background:#431407;border-color:#9a3412;color:#fed7aa}
a{color:var(--purple)}
`;
const FONT = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap">`;
const PAGES = [['index.html', 'Overview'], ['kindred.html', 'Kindred'], ['codebreaker.html', 'Codebreaker'], ['crosswordocious.html', 'Crosswordocious'], ['muddle.html', 'Muddle']];
const nav = (cur) => `<nav>${PAGES.map(([f, t]) => `<a href="${f}" class="${f === cur ? 'cur' : ''}">${t}</a>`).join('')}</nav>`;
const page = (file, title, accent, kick, lede, body) => fs.writeFileSync(path.join(OUT, file), `<title>${esc(title)}</title>\n${FONT}\n<style>${CSS}</style>\n<main>${nav(file)}<header><div class="kick">${esc(kick)}</div><h1 style="color:${accent}">${esc(title)}</h1><p class="lede">${lede}</p></header>${body}</main>\n`);
const stats = (items) => `<div class="stats">${items.map(([n, l]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
const HOW = `<div class="card wide"><div class="ttl">How to review</div><p style="margin:0">Skim; you are looking for anything you would not want in the app — a group that is unfair, a saying you do not recognize, a clue that could take two answers, a pun that does not land. Note the <b>id</b> of anything to cut or change (or open the CSV next to this page and set <b>keep</b> to <b>n</b>). Nothing here is live: the banks are built only from what survives.</p></div>`;

// ---------------- Kindred ----------------
const kin = J('kindred-bank.json');
let kinCount = 0;
if (kin) {
  const ps = kin.puzzles;
  kinCount = ps.length;
  const bad = ps.filter((p) => p.problems.length);
  const cards = ps.map((p) => {
    const words = p.groups.flatMap((g) => g.words), seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const shuffled = words.map((w, i) => [((i * 7919 + seed) % 16), w]).sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).map((x) => x[1]);
    return `<div class="card"><div class="id">${esc(p.id)} · ${esc(p.source || '')}${p.holiday ? ` · <span style="color:var(--purple)">holiday: ${esc(p.holiday)}</span>` : ''}${p.problems.length ? ` · <span style="color:#dc2626">${esc(p.problems.join('; '))}</span>` : ''}</div><div class="tiles16">${shuffled.map((w) => `<span>${esc(w)}</span>`).join('')}</div><details><summary>Show the groups</summary><div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">${p.groups.slice().sort((a, b) => a.tier - b.tier).map((g) => `<div class="grp g${g.tier}"><span class="pips">${'●'.repeat(g.tier)}</span><b>${esc(g.label)}</b><span>${g.words.join(', ')}</span></div>`).join('')}</div><div class="meta" style="margin-top:6px">Traps: ${esc(p.redHerrings)}</div></details></div>`;
  }).join('');
  page('kindred.html', 'Kindred bank', 'var(--wine)', `Groups of four · ${ps.length} puzzles · drafted ${date}`,
    `Sixteen words, four hidden groups, tiers from easy (one pip) to wordplay (four pips). The grid shows the puzzle as a player sees it; open a card for the answer. Every puzzle here passed the validator: real words, one solution, tiers 1–4.`,
    `${stats([[ps.filter((p) => !p.holiday).length, 'everyday puzzles'], [ps.filter((p) => p.holiday).length, 'holiday puzzles'], [ps.length - bad.length, 'validator clean'], [new Set(ps.flatMap((p) => p.groups.map((g) => g.label.toLowerCase()))).size, 'distinct group labels'], [Math.round(ps.filter((p) => !p.holiday).length / 30.4 * 10) / 10 + ' months', 'of everyday dailies']])}${HOW}<div class="grid">${cards}</div>`);
  csv('kindred.csv', ['keep', 'id', 'holiday', 'source', 'tier', 'label', 'words', 'alsoFits', 'redHerrings', 'problems'],
    ps.flatMap((p) => p.groups.slice().sort((a, b) => a.tier - b.tier).map((g) => ['y', p.id, p.holiday || '', p.source || '', g.tier, g.label, g.words.join(' '), (g.alsoFits || []).join(' '), p.redHerrings, p.problems.join('; ')])));
}
// ---------------- Codebreaker ----------------
const cg = J('cryptogram-bank.json');
let cgCount = 0;
if (cg) {
  const ps = cg.puzzles;
  cgCount = ps.length;
  const cards = ps.map((p) => {
    const giv = new Set(p.given || []), T = p.text.toUpperCase(); let k = 0;
    const words = p.cipher.split(' ').map((cwd) => { const cells = [...cwd].map((c) => { const pl = T[k++]; return /[A-Z]/.test(c) ? `<span class="cl${giv.has(pl) ? ' giv' : ''}"><b>${giv.has(pl) ? pl : ''}</b><i>${c}</i></span>` : `<span class="pn">${esc(c)}</span>`; }).join(''); k++; return `<span class="cword">${cells}</span>`; }).join('');
    return `<div class="card"><div class="id">${esc(p.id)} · ${p.text.length} chars · ${p.distinctLetters} letters · given ${(p.given || []).join(' ')}${p.holiday ? ` · <span style="color:var(--purple)">holiday: ${esc(p.holiday)}</span>` : ''}</div><p class="plain">${esc(p.text)}</p><details><summary>As the player sees it</summary><div class="cgram" style="margin-top:8px">${words}</div></details></div>`;
  }).join('');
  const rejects = cg.rejects?.length ? `<div class="warn"><b>${cg.rejects.length} rejected by the validator</b> (kept out of the bank): ${cg.rejects.map((r) => `${esc(r.text || r.id)} — ${esc(r.problems.join('; '))}`).join(' · ')}</div>` : '';
  const lens = ps.map((p) => p.text.length);
  page('codebreaker.html', 'Codebreaker bank', 'var(--umber)', `Cryptogram sayings · ${ps.length} puzzles · drafted ${date}`,
    `Everyday proverbs and sayings, 30–90 characters, with the three most frequent letters given at the start. Cut anything you do not think most players would know, anything misquoted, and anything that is a lyric, slogan or a named author's line.`,
    `${stats([[ps.filter((p) => !p.holiday).length, 'everyday sayings'], [ps.filter((p) => p.holiday).length, 'holiday sayings'], [Math.min(...lens) + '–' + Math.max(...lens), 'characters'], [Math.round(lens.reduce((a, b) => a + b, 0) / lens.length), 'average length'], [Math.round(ps.filter((p) => !p.holiday).length / 30.4 * 10) / 10 + ' months', 'of everyday dailies']])}${HOW}${rejects}<div class="grid">${cards}</div>`);
  csv('codebreaker.csv', ['keep', 'id', 'holiday', 'text', 'chars', 'distinctLetters', 'given'], ps.map((p) => ['y', p.id, p.holiday || '', p.text, p.text.length, p.distinctLetters, (p.given || []).join(' ')]));
}
// ---------------- Crosswordocious ----------------
const cw = J('crossword-bank.json');
let cwCount = 0, cwPairs = 0;
if (cw) {
  const ps = cw.puzzles;
  cwCount = ps.length;
  const bank = readJSON(path.join(REPO, 'apps', 'web', 'scripts', 'crossword', 'phrases.json'));
  cwPairs = Object.values(bank).reduce((n, t) => n + t.pairs.length, 0);
  const byTheme = {}; for (const p of ps) (byTheme[p.theme] ||= []).push(p);
  const gridHtml = (p) => { const g = Array.from({ length: p.h }, () => Array(p.w).fill(null)), num = {}; for (const e of p.entries) { num[e.r * 100 + e.c] = e.n; for (let k = 0; k < e.answer.length; k++) g[e.r + (e.dir === 'D' ? k : 0)][e.c + (e.dir === 'A' ? k : 0)] = e.answer[k]; }
    return `<div class="cw" style="grid-template-columns:repeat(${p.w},1fr)">${g.flatMap((row, r) => row.map((c, cc) => c ? `<span class="c">${num[r * 100 + cc] ? `<i>${num[r * 100 + cc]}</i>` : ''}${c}</span>` : '<span></span>')).join('')}</div>`; };
  const clues = (p, d) => p.entries.filter((e) => e.dir === d).map((e) => `<li><b class="nb">${e.n}</b><span>${esc(e.clue)} <span class="ans">${e.answer}</span></span></li>`).join('');
  const cards = ps.map((p) => `<div class="card wide"><div class="id">${esc(p.id)} · ${p.entries.length} entries · ${p.entries.filter((e) => e.onTheme).length} on theme · ${p.w}×${p.h}</div><div class="ttl">${esc(p.title)}</div><div class="cwwrap">${gridHtml(p)}<div class="clues"><div><h4>Across</h4><ul>${clues(p, 'A')}</ul></div><div><h4>Down</h4><ul>${clues(p, 'D')}</ul></div></div></div></div>`).join('');
  const evergreen = Object.entries(bank).filter(([, t]) => !t.holiday), holidays = Object.entries(bank).filter(([, t]) => t.holiday);
  const chip = ([k, t]) => `<span class="grp g1" style="font-size:12px">${esc(t.title)} <span class="meta">${t.pairs.length} pairs · ${(byTheme[k] || []).length} grids</span></span>`;
  const themeList = evergreen.map(chip).join('');
  let holidayHtml = '';
  if (holidays.length) {
    const { holidayDays } = await import('../crossword/holidays.mjs');
    const y = new Date().getFullYear() + 1, days = holidayDays(y), byKey = {};
    for (const [d, k] of Object.entries(days)) (byKey[k] ||= []).push(d.slice(5));
    const rows = holidays.map(([k, t]) => `<tr><td><b>${esc(t.title)}</b></td><td>${(byKey[t.holiday] || ['<i>not in the calendar yet</i>']).join(', ')}</td><td>${t.pairs.length}</td><td>${(byTheme[k] || []).length}</td><td class="meta">${(t.allow || []).join(' ')}</td></tr>`).join('');
    holidayHtml = `<div class="card wide"><div class="ttl">Holiday themes · run on their dates</div><p class="meta" style="margin:0">Every major holiday and US day off has its own theme, drawn on the day itself (dates shown for ${y}; Hebrew, lunar and Hindu dates are tabled and get a calendar check before the bank freezes). The rest of the year draws from the evergreen themes above. “Allowed” lists holiday words admitted although the common word list lacks them.</p><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="text-align:left;color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.6px"><th>Theme</th><th>Dates ${y}</th><th>Pairs</th><th>Grids</th><th>Allowed</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  const rejects = cw.rejected?.length ? `<div class="warn"><b>${cw.rejected.length} pairs rejected by the screen</b> (not in a grid): ${cw.rejected.map((r) => `${esc(r.answer)} “${esc(r.clue)}” — ${esc(r.why.join('; '))}`).join(' · ')}</div>` : '';
  page('crosswordocious.html', 'Crosswordocious bank', 'var(--slate)', `Themed fill-in sayings · ${Object.keys(bank).length} themes · ${cwPairs} phrase pairs · ${ps.length} grids · drafted ${date}`,
    `Each clue is a familiar phrase with one blank; the answer is the missing word. The title is the theme; most answers fit it and a few are other sayings. Grids are shown filled in with the answer after each clue. Cut any clue that could take a second answer of the same length, any phrase you do not think is common knowledge, and any answer you would rather not see.`,
    `${stats([[evergreen.length, 'evergreen themes'], [holidays.length, 'holiday themes'], [cwPairs, 'phrase pairs'], [ps.length, 'grids built'], [Math.round(ps.filter((p) => !p.holiday).length / 30.4 * 10) / 10 + ' months', 'of everyday dailies']])}${HOW}<div class="card wide"><div class="ttl">Evergreen themes</div><div style="display:flex;flex-wrap:wrap;gap:6px">${themeList}</div></div>${holidayHtml}${rejects}<div class="grid">${cards}</div>`);
  csv('crosswordocious-pairs.csv', ['keep', 'theme', 'title', 'clue', 'answer', 'length'], Object.entries(bank).flatMap(([k, t]) => t.pairs.map(([c, a]) => ['y', k, t.title, c, a, a.length])));
}
// ---------------- Muddle ----------------
const mud = J('muddle-bank.json');
let mudCount = 0;
if (mud) {
  const ps = mud.puzzles;
  mudCount = ps.length;
  const tiles = (w, cls = '') => `<span class="row">${[...w].map((c) => `<span class="t ${cls}">${esc(c)}</span>`).join('')}</span>`;
  const cards = ps.map((p) => `<div class="card"><div class="id">${esc(p.id)}${p.holiday ? ` · <span style="color:var(--purple)">holiday: ${esc(p.holiday)}</span>` : ''}</div><p class="cap">${esc(p.caption)}</p><p class="scene">Cartoon: ${esc(p.scene)}</p><details><summary>Words and answer</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">${p.words.map((w) => `<div class="mword"><div class="mscr">${esc(w.scramble)}</div><span class="row">${[...w.answer].map((c, i) => `<span class="t on${w.circled.includes(i) ? ' circ' : ''}">${c}</span>`).join('')}</span></div>`).join('')}<div><div class="meta">Punchline (${p.final.pattern.join(', ')})</div><div class="row" style="gap:10px">${p.final.answer.split(' ').map((w) => tiles(w, 'pun circ')).join('')}</div></div></div></details></div>`).join('');
  page('muddle.html', 'Muddle bank', 'var(--orange)', `Scrambled words and puns · ${ps.length} puzzles · no cartoons yet · drafted ${date}`,
    `Four scrambled words whose circled letters spell a pun that completes the caption. The cartoons are not drawn yet (that batch needs your image key); the “Cartoon:” line is the scene the artist will get. Cut any pun that does not land, any caption that gives the answer away, and any scene you would not want drawn.`,
    `${stats([[ps.filter((p) => !p.holiday).length, 'everyday puzzles'], [ps.filter((p) => p.holiday).length, 'holiday puzzles'], [ps.length * 4, 'scrambled words'], [mud.answerPool, 'answer words in the pool'], [Math.round(ps.filter((p) => !p.holiday).length / 30.4 * 10) / 10 + ' months', 'of everyday dailies']])}${HOW}<div class="grid">${cards}</div>`);
  csv('muddle.csv', ['keep', 'id', 'holiday', 'final', 'caption', 'words', 'scrambles', 'scene', 'altText'], ps.map((p) => ['y', p.id, p.holiday || '', p.final.answer, p.caption, p.words.map((w) => w.answer).join(' '), p.words.map((w) => w.scramble).join(' '), p.scene, p.altText]));
}
// ---------------- Index ----------------
const rows = [
  ['Kindred', 'kindred.html', kinCount, 'puzzles', 'Groups of four. Validator proves one solution per puzzle.', 'var(--wine)'],
  ['Codebreaker', 'codebreaker.html', cgCount, 'sayings', 'Proverbs 30–90 chars, three letters given, stored cipher key.', 'var(--umber)'],
  ['Crosswordocious', 'crosswordocious.html', cwCount, 'grids', `${cwPairs} phrase pairs → grids of 10–13 entries, ≥ 60 % on theme.`, 'var(--slate)'],
  ['Muddle', 'muddle.html', mudCount, 'puzzles', 'Puns + captions + scenes, composed into four words. Cartoons later.', 'var(--orange)'],
];
page('index.html', 'More Games content banks', 'var(--purple)', `Founder review pack · drafted ${date}`,
  `The four More Games titles that need authored content, drafted overnight and machine-validated, ready for your veto pass. Each page shows the puzzles as a player would meet them, with the answers a tap away; each has a CSV beside it with a <b>keep</b> column. Hubbub, Letter Ladder, Spyglass (theme bank still awaiting your skim), Sudoku and Starsweep need no authored content.`,
  `<div class="grid">${rows.map(([t, f, n, u, d, a]) => `<a class="card" href="${f}" style="text-decoration:none;color:inherit"><div class="ttl" style="color:${a}">${t}</div><div class="stat" style="border:0;padding:0"><b>${n}</b><span>${u}</span></div><div class="meta">${d}</div></a>`).join('')}</div>
<div class="card wide"><div class="ttl">A year of puzzles, holidays on their dates, and an alarm before we run low</div><p style="margin:0 0 6px">Every game ships at least 365 everyday puzzles. On a holiday the daily comes from that holiday's own set (Christmas, Hanukkah, MLK Day, Juneteenth, Diwali and the rest — 28 in all, listed on the Crosswordocious page), and the everyday puzzle that day is simply never dated. When a bank is exhausted it replays from its first puzzle, oldest first, so nothing ever breaks; CI turns red 60 days before that, the nightly sweep flags it at 90 days on the admin Ops page, and Sentry emails you at 30. Classic, Six, Seven, QuadWord, OctoWord and Gauntlet get holiday answers from a separate word table (514 words, 28 holidays) once that stage is built.</p></div>
<div class="card wide"><div class="ttl">What happens after your pass</div><ol style="margin:0;padding-left:20px"><li>Anything marked <b>n</b> in a CSV (or listed by id) is removed from the source bank in <code>apps/web/scripts/&lt;game&gt;/</code>; edits are applied in place.</li><li>The real bank builders then run once and the result is frozen, epoch-indexed and bundled on all three platforms, the same way Hubbub, Letter Ladder and Spyglass were.</li><li>Muddle's cartoon batch runs only after that, with your image key, ten first for a style check.</li></ol></div>`);
console.log('wrote', OUT, PAGES.map(([f]) => f).join(' '), `| kindred ${kinCount} · codebreaker ${cgCount} · crossword ${cwCount} grids / ${cwPairs} pairs · muddle ${mudCount}`);
