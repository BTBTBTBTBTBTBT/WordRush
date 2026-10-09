import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 2.8 item 23 (founder 10-07: "All buttons should be covered"): no button ships outside the
 * ChatGPT family style. This is the ×3 guard: it fails when a screen draws a RAW button that is
 * not one of the family components (web family-button / candy-button / cast-button, iOS
 * FamilyButtons / CandyButtonStyle / CastButtonStyle, Android FamilyButtons / CandyButton / CastButton).
 *
 * It is a RATCHET over the audited inventory (docs/audits/2.8-inventory/buttons.md): every
 * non-family call site that exists today is counted per file in button-family-baseline.json. A
 * count may only go DOWN (as sites migrate to the family components) — a new raw button, or a new
 * file with one, fails here. Admin pages and the keycap / tile / row / scrim tiers are not buttons
 * in the family sense and are allow-listed below. Regenerate the baseline after a migration with
 *   UPDATE_BUTTON_BASELINE=1 npx vitest run scripts/button-family-guard.test.ts
 *
 * What counts as a raw button:
 *  - web: a `<button` whose tag carries none of the family class tokens (candy, cast-, fam-round,
 *    kkey, gtile, ss-cell, mud-chip, hdr-glyph, data-squish, data-tile) — files that DEFINE the family are exempt;
 *  - iOS: `.buttonStyle(.squish…)` pills / icons, a hand-rolled `ButtonStyle` struct outside the family files,
 *    `KeyPressStyle` outside the keyboards;
 *  - Android: `squishClickable(` / `pressScale(` outside the family files, and ANY Material Button / IconButton / TextButton / OutlinedButton.
 */
const REPO = join(__dirname, '..', '..', '..');
const BASELINE = join(__dirname, 'button-family-baseline.json');

const FAMILY_FILES = [
  'apps/web/components/ui/family-button.tsx', 'apps/web/components/ui/candy-button.tsx', 'apps/web/components/ui/cast-button.tsx',
  'apps/ios/Wordocious/Sources/FamilyButtons.swift', 'apps/ios/Wordocious/Sources/CastButton.swift', 'apps/ios/Wordocious/Sources/FinishKit.swift',
  'apps/android/app/src/main/kotlin/com/wordocious/app/ui/FamilyButtons.kt', 'apps/android/app/src/main/kotlin/com/wordocious/app/ui/FinishKit.kt',
  'apps/android/app/src/main/kotlin/com/wordocious/app/ui/CastButton.kt',
];
const WEB_FAMILY_TOKEN = /\b(candy|cast-|fam-round|kkey|gtile|ss-cell|mud-chip|hdr-glyph|data-squish|data-tile)/;

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'build' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(REPO, p).split('\\').join('/');

/** The text of each `<button …>` opening tag (up to the first `>` that is not an arrow `=>`). */
function webButtonTags(src: string): string[] {
  const tags: string[] = [];
  const re = /<button\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 7;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    tags.push(src.slice(m.index, i + 1));
  }
  return tags;
}

export function scanWeb(): Record<string, number> {
  const out: Record<string, number> = {};
  const files = [...walk(join(REPO, 'apps/web/components'), ['.tsx']), ...walk(join(REPO, 'apps/web/app'), ['.tsx'])];
  for (const f of files) {
    const r = rel(f);
    if (r.includes('/admin/') || r.startsWith('apps/web/app/admin') || FAMILY_FILES.includes(r) || r.endsWith('.test.tsx')) continue;
    const n = webButtonTags(readFileSync(f, 'utf8')).filter((t) => !WEB_FAMILY_TOKEN.test(t)).length;
    if (n > 0) out[r] = n;
  }
  return out;
}

export function scanIos(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of walk(join(REPO, 'apps/ios/Wordocious/Sources'), ['.swift'])) {
    const r = rel(f);
    if (FAMILY_FILES.includes(r)) continue;
    const src = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const squish = (src.match(/\.buttonStyle\(\s*\.squish(Icon)?\s*\)/g) ?? []).length;
    const custom = (src.match(/:\s*ButtonStyle\b/g) ?? []).length;
    const keys = r.endsWith('KeyboardView.swift') || r.includes('Keyboard') || /LetterKeyboard|ProperNoundle|SudokuView|CodebreakerView/.test(r) ? 0 : (src.match(/KeyPressStyle\(/g) ?? []).length;
    const n = squish + custom + keys;
    if (n > 0) out[r] = n;
  }
  return out;
}

export function scanAndroid(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of walk(join(REPO, 'apps/android/app/src/main/kotlin'), ['.kt'])) {
    const r = rel(f);
    if (FAMILY_FILES.includes(r)) continue;
    const src = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    const squish = (src.match(/\.squishClickable\(/g) ?? []).length + (src.match(/\.pressScale\(/g) ?? []).length;
    const material = (src.match(/(^|[^A-Za-z.])(Button|IconButton|TextButton|OutlinedButton|FilledTonalButton)\(/gm) ?? []).length;
    const n = squish + material;
    if (n > 0) out[r] = n;
  }
  return out;
}

type Baseline = { web: Record<string, number>; ios: Record<string, number>; android: Record<string, number> };

if (process.env.UPDATE_BUTTON_BASELINE === '1') {
  writeFileSync(BASELINE, JSON.stringify({ web: scanWeb(), ios: scanIos(), android: scanAndroid() } satisfies Baseline, null, 2) + '\n');
}

function ratchet(label: string, now: Record<string, number>, base: Record<string, number>) {
  const worse = Object.entries(now).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${n} raw buttons (baseline ${base[f] ?? 0})`);
  expect(worse, `${label}: a raw button outside the family components crept in. Use HelperButton / QuietButton / RoundIconButton / FamilyCloseButton / CandyButton / CastButton (see docs/audits/2.8-inventory/buttons.md).`).toEqual([]);
}

describe('every button is on the family style (2.8 item 23 guard)', () => {
  const base: Baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { web: {}, ios: {}, android: {} };

  it('web: no new raw <button> outside the family components', () => ratchet('web', scanWeb(), base.web));
  it('iOS: no new squish pill / icon, hand-rolled ButtonStyle or stray KeyPressStyle', () => ratchet('iOS', scanIos(), base.ios));
  it('Android: no new squishClickable / pressScale pill or Material button', () => ratchet('Android', scanAndroid(), base.android));

  it('the baseline only ever shrinks (a stale baseline hides progress — regenerate it)', () => {
    const stale: string[] = [];
    for (const [label, now, b] of [['web', scanWeb(), base.web], ['ios', scanIos(), base.ios], ['android', scanAndroid(), base.android]] as const) {
      for (const [f, n] of Object.entries(b)) if ((now[f] ?? 0) < n) stale.push(`${label} ${f}: ${now[f] ?? 0} < baseline ${n}`);
    }
    expect(stale, 'migrated buttons: run UPDATE_BUTTON_BASELINE=1 npx vitest run scripts/button-family-guard.test.ts').toEqual([]);
  });
});
