import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { gameHeaderArtHeight } from '@/lib/art';

// FINISH_SPEC AG (desktop web wide-screen layout): one CSS lever in
// app/globals.css (.page-col / .page-wide / .page-wide-pad / .page-grid-2 /
// .page-pop / the docked tab row). These checks keep the approved numbers and
// make sure phones (< 900 px) are never touched by it.

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const css = read('app/globals.css');
const start = css.lastIndexOf('/* ──', css.indexOf('FINISH_SPEC AG · desktop web'));
const block = css.slice(start, css.indexOf('/* ──', start + 10));

describe('AG wide layout (globals.css)', () => {
  it('has the block with the approved sizes', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toMatch(/--page-col:\s*560px/);
    expect(block).toMatch(/--page-wide:\s*1100px/);
    expect(block).toMatch(/--page-pop:\s*440px/);
  });

  it('only acts at 900 px and wider (the :root sizes are the only rules outside the media query)', () => {
    const firstMedia = block.indexOf('@media');
    expect(firstMedia).toBeGreaterThan(-1);
    const head = block.slice(0, firstMedia).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(head).not.toMatch(/\.page-|\.tab-dock/);
    for (const m of block.matchAll(/@media \(([^)]*)\)/g)) expect(m[1]).toBe('min-width: 900px');
  });

  it('lays two equal columns, centers the column and the docked tabs, caps popups', () => {
    expect(block).toMatch(/\.page-grid-2 \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(block).toMatch(/\.page-col \{[^}]*max-width: var\(--page-col\)[^}]*margin-left: auto/);
    expect(block).toMatch(/\.page-pop \{[^}]*max-width: var\(--page-pop\)/);
    expect(block).toMatch(/\.tab-dock \{[^}]*calc\(\(100% - var\(--page-col\)\) \/ 2\)/);
  });
});

describe('AG wide layout (call sites)', () => {
  it('puts every solo game screen and the header in the column', () => {
    expect(read('components/ui/page-background.tsx')).toMatch(/className=\{`page-col \$\{className\}`\}/);
    expect(read('components/ui/app-header.tsx')).toMatch(/<header className="[^"]*\bpage-col\b/);
  });

  it('sizes game header title art by the column, not the window', () => {
    expect(gameHeaderArtHeight('art-game-quordle')).toContain('var(--game-col-w, 100vw)');
    expect(block).toMatch(/--game-col-w: var\(--page-col\)/);
  });

  it('gives Home, Leaderboard, Stats and Friends the two-column grid', () => {
    for (const f of ['app/page.tsx', 'app/daily/page.tsx', 'app/stats/page.tsx', 'components/friends/friends-panel.tsx']) {
      expect(read(f), f).toMatch(/className="page-grid-2\b/);
    }
  });
});
