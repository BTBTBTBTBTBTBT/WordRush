import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ALL_LOOP_CLASSES, LOOP_CLASSES, LOOP_SELECTOR, MAX_RUNNING_LOOPS, TAILWIND_LOOP_CLASSES, capLoops } from './motion-pause';
import { GLOSS_SWEEP, sweepAllowed, sweepRunMs } from './gloss-sweep';
import { DECODE_WAIT_MS, entranceWait, tabWallpaperSrcs } from './predecode';

// The web smoothness pass (founder 10-02: "the animation on the website was
// choppy too"): animate only transform + opacity, no animated box-shadow /
// filter / blur, will-change only while animating, pre-decoded art, capped and
// paused loops, Reduce Motion everywhere.

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const css = read('app/globals.css');

/** Every @keyframes body in the stylesheet, by name. */
function keyframes(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /@keyframes ([\w-]+) \{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.set(m[1], css.slice(m.index + m[0].length, i - 1));
  }
  return out;
}

describe('keyframes animate only cheap properties', () => {
  const frames = keyframes();

  it('never animates box-shadow, blur or layout boxes', () => {
    expect(frames.size).toBeGreaterThan(40);
    for (const [name, body] of frames) {
      expect(body, name).not.toMatch(/\bbox-shadow\s*:/);
      expect(body, name).not.toMatch(/blur\(/);
      expect(body, name).not.toMatch(/(^|[\s{;])(width|height|top|left|right|bottom|margin[\w-]*|padding[\w-]*)\s*:/);
    }
  });

  it('animates filter nowhere but the lose sink settle (one-shot, five tiles)', () => {
    const withFilter = [...frames].filter(([, body]) => /\bfilter\s*:/.test(body)).map(([name]) => name);
    expect(withFilter).toEqual(['gt-sink']);
  });

  it('keeps background-position loops to the unused legacy gradients and the one-shot headline gloss', () => {
    const withBgPos = [...frames].filter(([, body]) => /background-position\s*:/.test(body)).map(([name]) => name).sort();
    expect(withBgPos).toEqual(['gradient-slow', 'gradient-x', 'lh-sweep']);
  });
});

describe('no permanent layers, no live blur', () => {
  it('keeps will-change only on pieces that are animating the whole time they exist', () => {
    const rules = [...css.matchAll(/([^{}]+)\{[^}]*will-change[^}]*\}/g)].map((m) => m[1].trim());
    expect(rules).toEqual(['.confetti-piece']);
  });

  it('draws the Home banner strip without a backdrop blur', () => {
    expect(css).not.toMatch(/backdrop-filter:\s*blur/);
    expect(read('components/home/home-banner.tsx')).not.toMatch(/backdrop-blur|backdropFilter/);
  });

  it('puts the cast shadow on the still image, not the moving cell', () => {
    expect(css).toMatch(/\.castrow \.cm \{[^}]*\}/);
    expect(css.match(/\.castrow \.cm \{([^}]*)\}/)?.[1]).not.toMatch(/filter/);
    expect(css).toMatch(/\.castrow \.cm > img \{[^}]*filter: drop-shadow/);
    const intro = read('components/providers/cold-start-intro.tsx');
    // The intro's W: the wrapper bounces, the image keeps the shadow.
    expect(intro).toMatch(/className=\{phase === 'w' && !reduced && started \? 'intro-bounce' : ''\}\s*style=\{\{\s*position: 'absolute',[\s\S]*?\}\}\s*>\s*\{\/\*/);
    expect(intro).toContain("addEventListener('transitionend', onEnd)");
  });

  it('glows by opacity over pre-drawn shadows', () => {
    for (const cls of ['.gt-glow-bad', '.gt-glow-hint', '.candy-badge-pulse::after', '.gauntlet-glow::after']) {
      const body = css.match(new RegExp(`${cls.replace(/[.:]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`))?.[1] ?? '';
      expect(body, cls).toMatch(/box-shadow:/);
      expect(body, cls).toMatch(/opacity: 0;/);
      expect(body, cls).toMatch(/animation:/);
    }
    const tile = read('components/game/letter-tile.tsx');
    expect(tile).toContain('className="gt-glow-bad"');
    expect(tile).toContain('className="gt-glow-hint"');
    expect(read('components/gauntlet/gauntlet-progress.tsx')).not.toMatch(/animation: 'gauntlet-glow/);
  });
});

describe('loops: paused off-screen and while scrolling, capped on screen', () => {
  it('covers the Tailwind loops too', () => {
    expect(TAILWIND_LOOP_CLASSES).toEqual(['animate-pulse', 'animate-ping', 'animate-spin']);
    expect(ALL_LOOP_CLASSES).toEqual([...LOOP_CLASSES, ...TAILWIND_LOOP_CLASSES]);
    for (const c of ALL_LOOP_CLASSES) {
      expect(LOOP_SELECTOR).toContain(`.${c}`);
      expect(css, c).toContain(`html[data-scrolling="true"] .${c}`);
    }
    expect(css).toContain('[data-loop-capped="true"], [data-loop-capped="true"]::before, [data-loop-capped="true"]::after { animation-play-state: paused !important; }');
  });

  it('runs the first loops in page order, dialogs first, the rest wait', () => {
    expect(MAX_RUNNING_LOOPS).toBe(8);
    const list = Array.from({ length: 11 }, (_, i) => i);
    expect(capLoops(list, 8)).toEqual({ run: [0, 1, 2, 3, 4, 5, 6, 7], wait: [8, 9, 10] });
    expect(capLoops(list.slice(0, 3), 8)).toEqual({ run: [0, 1, 2], wait: [] });
    // A popup's loops (listed last in the page) always run.
    expect(capLoops(list, 4, (n) => n >= 9)).toEqual({ run: [9, 10, 0, 1], wait: [2, 3, 4, 5, 6, 7, 8] });
    expect(capLoops([], 8)).toEqual({ run: [], wait: [] });
  });

  it('sweeps a headline once in a while, never as an infinite loop', () => {
    expect(css).not.toMatch(/\.lh-sweep \.lh-gloss \{[^}]*infinite/);
    expect(css).toMatch(/\.lh-sweeping \.lh-gloss \{ animation: lh-sweep 840ms/);
    expect(GLOSS_SWEEP.runMs).toBe(840);
    expect(sweepRunMs(1)).toBe(840);
    expect(sweepRunMs(20)).toBe(840 + 19 * 30);
    const ok = { offscreen: false, scrolling: false, hidden: false, reduced: false, intro: false, running: 0 };
    expect(sweepAllowed(ok)).toBe(true);
    expect(sweepAllowed({ ...ok, offscreen: true })).toBe(false);
    expect(sweepAllowed({ ...ok, scrolling: true })).toBe(false);
    expect(sweepAllowed({ ...ok, hidden: true })).toBe(false);
    expect(sweepAllowed({ ...ok, reduced: true })).toBe(false);
    expect(sweepAllowed({ ...ok, intro: true })).toBe(false);
    expect(sweepAllowed({ ...ok, running: GLOSS_SWEEP.maxConcurrent })).toBe(false);
  });
});

describe('art is decoded before it animates', () => {
  it('holds a popup at most a few frames, and not at all when its art is ready', () => {
    expect(DECODE_WAIT_MS).toBeLessThanOrEqual(200);
    expect(entranceWait([])).toBe('none');
    expect(entranceWait([{ complete: true, naturalWidth: 90 }])).toBe('none');
    expect(entranceWait([{ complete: true, naturalWidth: 90 }, { complete: false, naturalWidth: 0 }])).toBe('decode');
    expect(entranceWait([{ complete: true, naturalWidth: 0 }])).toBe('decode');
    expect(css).toContain('.motion-wait { visibility: hidden; }');
    for (const f of ['components/effects/result-popup.tsx', 'components/badges/badge-celebration.tsx', 'components/effects/sweep-celebration.tsx']) {
      expect(read(f), f).toMatch(/useDecodedEntrance<HTMLDivElement>\(\)[\s\S]*ref=\{entranceRef\}[\s\S]*motion-wait/);
    }
  });

  it('warms the four tab wallpapers (the wide twins on desktop)', () => {
    expect(tabWallpaperSrcs(true)).toEqual(['/art/art-wall-home-wide.webp', '/art/art-wall-leaderboard-wide.webp', '/art/art-wall-stats-wide.webp', '/art/art-wall-friends-wide.webp']);
    expect(tabWallpaperSrcs(false)[0]).toBe('/art/art-wall-home.webp');
  });
});

describe('no per-frame React work on hot screens', () => {
  it('re-renders only the clock each second on Home', () => {
    const home = read('app/page.tsx');
    expect(home).not.toMatch(/useCountdown\(getSecondsUntilMidnightLocal\)/);
    expect(home).toMatch(/useCountdown\(getResetSeconds, needsResetClock\)/);
    expect(read('components/home/home-banner.tsx')).toContain('<HomeClock render=');
  });

  it('counts the popup points up in their own component', () => {
    const popup = read('components/effects/result-popup.tsx');
    expect(popup).toContain('function CountUpPoints');
    expect(popup).not.toMatch(/useCountUp\(p\.points\)/);
  });

  it('slides the VS queue bar instead of growing its width', () => {
    const q = read('components/vs/vs-queue.tsx');
    expect(q).not.toMatch(/style\.width =/);
    expect(q).toMatch(/style\.transform = `translateX/);
  });
});
