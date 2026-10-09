import * as React from 'react';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { checkA11y } from '@/lib/a11y-static';

// 2.8 item 40: an automated accessibility check on the new 2.8 surfaces (axe-style rules over the server-rendered
// markup: image alt, button / heading names, role=img labels, nothing focusable inside aria-hidden).

// the components use the classic JSX runtime (React in scope); the tests render them with react-dom/server
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; width?: number; height?: number }) => h('img', { src: String(p.src), alt: p.alt, width: p.width, height: p.height }),
}));
vi.mock('next/link', () => ({
  default: (p: { href: string; children?: unknown; [k: string]: unknown }) => { const { href, children, ...rest } = p; return h('a', { href, ...rest }, children as never); },
}));

vi.mock('@/hooks/use-flags', () => ({
  useFlags: () => ({ isOn: () => true, isLive: () => true, loading: false }),
  useLivingMascotOn: () => false,
}));

vi.mock('@/lib/theme-context', () => ({ useTheme: () => ({ theme: 'default', setTheme: () => {} }) }));

const render = (el: ReactElement) => renderToStaticMarkup(el);

describe('the checker itself', () => {
  it('flags the common failures', () => {
    const bad = '<div><img src="a.png"><button></button><span role="img"></span><span role="heading"></span><div aria-hidden="true"><button>x</button></div><button aria-label=" "></button></div>';
    const rules = checkA11y(bad).map((v) => v.rule);
    for (const r of ['image-alt', 'button-name', 'role-img-alt', 'heading-name', 'aria-hidden-focus', 'aria-label-not-empty']) expect(rules).toContain(r);
  });

  it('passes labelled, decorative and sr-only content', () => {
    const ok = '<div><img src="a.png" alt=""><button aria-label="Close"><img src="x.png" alt=""></button><button><span class="sr-only">Go</span></button>'
      + '<span role="img" aria-label="7 days"></span><span role="heading" aria-level="2" aria-label="ALL DONE"><span aria-hidden="true">A</span></span>'
      + '<div aria-hidden="true"><button tabindex="-1">x</button></div></div>';
    expect(checkA11y(ok)).toEqual([]);
  });
});

describe('2.8 surfaces render without accessibility violations', () => {
  it('the family buttons (round icon, quiet) and the stage close', async () => {
    const { RoundIconButton, QuietButton } = await import('@/components/ui/family-button');
    const { StageClose } = await import('@/components/profile/dress-up');
    const html = render(h('div', null,
      h(RoundIconButton, { icon: 'close', label: 'Close' }),
      h(QuietButton, { size: 'sm' }, 'Not now'),
      h(StageClose, { onClick: () => {}, label: 'Close' })));
    expect(checkA11y(html)).toEqual([]);
    expect(html).toContain('aria-label="Close"');
  });

  it('the decorative headline lines hide from assistive tech and the wrapper speaks once', async () => {
    const { LiveHeadline } = await import('@/components/ui/live-headline');
    const one = render(h(LiveHeadline, { text: 'ALL 8 DAILIES' }));
    expect(one).toContain('role="heading"');
    expect(one).toContain('aria-label="ALL 8 DAILIES"');
    const line = render(h(LiveHeadline, { text: 'WON TODAY!', decorative: true }));
    expect(line).not.toContain('role="heading"');
    expect(line).toContain('aria-hidden="true"');
    expect(checkA11y(`<div role="heading" aria-level="2" aria-label="ALL 8 DAILIES WON TODAY!">${line}</div>`)).toEqual([]);
  });

  it('the podium pedestal and floor art are decorative', async () => {
    const { PodiumPedestal, PodiumFloor } = await import('@/components/leaderboard/podium');
    const html = render(h('div', null, h(PodiumPedestal, { place: 1, height: 74, label: 1 }), h(PodiumPedestal, { place: 2, height: 54, label: 5 }), h(PodiumFloor, {})));
    expect(checkA11y(html)).toEqual([]);
  });

  it('a mascot picture is decorative unless it is given a label', async () => {
    const { MascotAvatar } = await import('@/components/avatar/mascot-avatar');
    const config = { display: 'mascot', body: 'classic', color: 'purple' } as never;
    const plain = render(h(MascotAvatar, { config, initial: 'D', size: 64, cutout: true }));
    expect(checkA11y(plain)).toEqual([]);
    const named = render(h(MascotAvatar, { config, initial: 'D', size: 64, cutout: true, label: "doug's mascot" }));
    expect(named).toContain('role="img"');
    expect(checkA11y(named)).toEqual([]);
  });

  it('a wrapped bubble headline is ONE heading with the whole sentence; the letters are decorative', async () => {
    const { BubbleText } = await import('@/components/ui/bubble-text');
    const html = render(h(BubbleText, { text: 'ALL 8 DAILIES WON TODAY!', slotWidth: 150, maxSize: 34, minSize: 20, level: 2, live: true }));
    expect(html.match(/role="heading"/g)?.length).toBe(1);
    expect(html).toContain('aria-label="ALL 8 DAILIES WON TODAY!"');
    expect(html).toContain('aria-live="polite"');
    expect(checkA11y(html)).toEqual([]);
    // an empty headline is hidden, not announced as nothing
    const empty = render(h(BubbleText, { text: ' ', slotWidth: 150 }));
    expect(empty).not.toContain('role="heading"');
    expect(checkA11y(empty)).toEqual([]);
  });

  it('the header counters name themselves with their number', async () => {
    const { HeaderGlyph } = await import('@/components/ui/header-glyph');
    const html = render(h('div', null,
      h(HeaderGlyph, { icon: 'flame', value: 5, label: 'Daily streak: 5', onClick: () => {} }),
      h(HeaderGlyph, { icon: 'trophy', value: 2, label: 'Flawless streak: 2', onClick: () => {} })));
    expect(checkA11y(html)).toEqual([]);
    expect(html).toContain('aria-label="Flawless streak: 2"');
  });
});
