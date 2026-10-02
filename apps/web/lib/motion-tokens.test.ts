import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MOTION } from './motion-tokens';

// FINISH_SPEC AZ: one motion family, transform/opacity only, no live blur under moving popups.

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const css = read('app/globals.css');

describe('motion fluidity pass (AZ)', () => {
  it('keeps the CSS motion tokens in step with MOTION', () => {
    expect(css).toContain(`--m-spring: ${MOTION.spring};`);
    expect(css).toContain(`--m-spring-ms: ${MOTION.springMs}ms;`);
    expect(css).toContain(`--m-ease-out: ${MOTION.easeOut};`);
    expect(css).toContain(`--m-fade-ms: ${MOTION.fadeMs}ms;`);
    expect(css).toContain(`--m-exit-ms: ${MOTION.exitMs}ms;`);
  });

  it('springs popups in with the shared family and gives them a matching exit', () => {
    expect(css).toContain('.animate-modal-content { animation: modal-content-in var(--m-spring-ms) var(--m-spring) both; }');
    expect(css).toContain('.animate-fade-in-scale { animation: fade-in-scale var(--m-spring-ms) var(--m-spring) both; }');
    expect(css).toMatch(/@keyframes m-card-out \{ to \{ opacity: 0; transform: [^}]*\} \}/);
    expect(read('components/ui/streak-popups.tsx')).toContain('useExit(open)');
  });

  it('popup keyframes animate only transform and opacity', () => {
    for (const name of ['modal-content-in', 'fade-in-scale', 'rp-spring', 'st-card-in', 'st-card-out', 'm-card-out', 'm-scrim-out', 'confetti']) {
      const m = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n?\\}\\s*(?:\\n|$)`));
      const body = m?.[1] ?? '';
      expect(body, name).not.toBe('');
      expect(body, name).not.toMatch(/\b(width|height|padding|margin|top|left|box-shadow|filter|backdrop-filter)\s*:/);
    }
  });

  it('caps the confetti and drops live blurs under moving popups', () => {
    expect(MOTION.confettiMax).toBeLessThanOrEqual(40);
    expect(read('components/effects/confetti.tsx')).toContain('MOTION.confettiMax');
    for (const f of ['components/game/multi-board.tsx', 'components/vs/vs-game.tsx', 'components/gauntlet/gauntlet-game.tsx', 'components/gauntlet/stage-transition.tsx']) {
      expect(read(f), f).not.toMatch(/backdrop-blur|backdropFilter/);
    }
  });
});
