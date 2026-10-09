'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ageCheckYears, AGE_CHECK_SUPPORT_EMAIL } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { CastHeader } from '@/components/ui/cast-header';
import { BubbleText } from '@/components/ui/bubble-text';
import { castArt, useSeason } from '@/lib/season';
import { PageBackground } from '@/components/ui/page-background';

// The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29). D (glasses + pencil) SAYS ONE question,
// "What year were you born?", in a comic speech bubble set in our bubble lettering, on a year wheel with NO default and
// no hint that 13 matters. The live WORDOCIOUS cast row stays at the top; below it D and the birthday cake stand on one
// soft floor as ONE scene (docs/design/brand/2.8/agecheck + bubbles: props from ChatGPT, canonical cast hero placed as is).
// The verdict, storage and server sync live in the caller (AgeGate) — this screen only collects a year.

const ROW = 54;
const VISIBLE = 5;

/**
 * The year wheel: CSS scroll-snap, centered row picks. Row 0 is a neutral "• • •" placeholder (as on iOS / Android),
 * so no year ever sits in the gold band until the player moves the wheel.
 */
function YearWheel({ years, onPick }: { years: number[]; onPick: (year: number | null) => void }) {
  // In season the wheel is the same black-violet glass as D's bubble, so it belongs to the night scene.
  const night = useSeason() !== null;
  const ref = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);
  const [index, setIndex] = useState(0);

  // Rows: 0 = the placeholder, 1… = years[row - 1].
  const pickIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(years.length, i));
      setIndex(clamped);
      setTouched(clamped > 0);
      onPick(clamped > 0 ? years[clamped - 1] : null);
    },
    [years, onPick],
  );

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ROW);
    if (i !== index || !touched) {
      // Only a real scroll (not the initial layout) counts as an answer.
      if (el.scrollTop > 0 || touched) pickIndex(i);
    }
  };

  const goTo = (i: number) => {
    ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' });
    pickIndex(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(index - 1); }
  };

  return (
    <div
      className="relative mx-auto"
      style={{
        width: 168,
        height: ROW * VISIBLE,
        borderRadius: 34,
        background: night
          ? 'linear-gradient(180deg, rgba(42,16,64,0.80), rgba(63,27,94,0.88) 50%, rgba(42,16,64,0.80))'
          : 'linear-gradient(180deg, rgba(196,181,253,0.55), rgba(233,213,255,0.85) 50%, rgba(196,181,253,0.55))',
        boxShadow: night
          ? '0 10px 28px rgba(249,115,22,0.22), inset 0 0 0 1.5px rgba(249,115,22,0.35)'
          : '0 10px 28px rgba(124,58,237,0.22), inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -3px 8px rgba(124,58,237,0.18)',
      }}
    >
      {/* The gold selection band — the wheel's "answer" slot. */}
      <div
        aria-hidden
        className="absolute left-[-6px] right-[-6px] pointer-events-none"
        style={{
          top: ROW * 2,
          height: ROW,
          borderRadius: 22,
          background: 'linear-gradient(180deg, rgba(253,224,71,0.55), rgba(251,191,36,0.38))',
          boxShadow: '0 0 18px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label="Year you were born"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKey}
        className="h-full overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          overscrollBehavior: 'contain',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 28%, #000 72%, transparent)',
          maskImage: 'linear-gradient(180deg, transparent, #000 28%, #000 72%, transparent)',
        }}
      >
        <div style={{ height: ROW * 2 }} />
        {/* The neutral placeholder row: no year is ever pre-selected. */}
        <div
          role="option"
          aria-selected={!touched}
          aria-label="No year chosen"
          onClick={() => goTo(0)}
          className="flex items-center justify-center cursor-pointer select-none"
          style={{ height: ROW, scrollSnapAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: '0.3em',
            color: night ? '#ffdb8c' : '#4c1d95' }}
        >
          {'\u2022\u2022\u2022'}
        </div>
        {years.map((y, yi) => {
          const i = yi + 1;
          const on = touched && i === index;
          return (
            <div
              key={y}
              role="option"
              aria-selected={on}
              onClick={() => goTo(i)}
              className="flex items-center justify-center cursor-pointer select-none"
              style={{
                height: ROW,
                scrollSnapAlign: 'center',
                fontSize: on ? 32 : 24,
                fontWeight: 900,
                color: night ? (on ? '#ffdb8c' : 'rgba(255,219,140,0.5)') : (on ? '#4c1d95' : 'rgba(109,40,217,0.5)'),
                fontVariantNumeric: 'tabular-nums',
                transition: 'font-size 120ms ease, color 120ms ease',
              }}
            >
              {y}
            </div>
          );
        })}
        <div style={{ height: ROW * 2 }} />
      </div>
    </div>
  );
}

/** The comic speech bubble (tail toward D) with a line of bubble lettering inside. Halloween: the black-violet candy one. */
function SpeechBubble({ text, halloween, style }: { text: string; halloween: boolean; style?: React.CSSProperties }) {
  const aspect = halloween ? 401 / 327 : 398 / 295;
  return (
    <div className="relative" style={{ aspectRatio: String(aspect), ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={halloween ? '/age-check/bubble-halloween.webp' : '/age-check/bubble.webp'} alt="" aria-hidden="true" draggable={false}
        className="absolute inset-0 w-full h-full select-none pointer-events-none" />
      <div className="absolute flex items-center justify-center" style={{ left: '9%', right: '9%', top: '9%', bottom: halloween ? '29%' : '27%' }}>
        <BubbleText text={text} palette={halloween ? 'celebrate' : 'home'} maxSize={46} minSize={20} level={1} className="w-full" />
      </div>
    </div>
  );
}

/** A soft elliptical contact shadow on the shared floor. */
function Contact({ left, width, bottom }: { left: string; width: string; bottom: number }) {
  return (
    <span aria-hidden="true" className="absolute pointer-events-none" style={{
      left, width, bottom, height: 16, borderRadius: '50%',
      background: 'radial-gradient(ellipse at center, rgba(76,29,149,0.30), rgba(76,29,149,0) 70%)',
    }} />
  );
}

/** The one scene: D says the question; the cake sits beside him on the same floor, same lighting. */
function AskScene() {
  const season = useSeason();
  const halloween = season !== null;
  return (
    <div className="w-full flex flex-col items-center" style={{ maxWidth: 340 }}>
      <SpeechBubble text="WHAT YEAR WERE YOU BORN?" halloween={halloween} style={{ width: '86%', alignSelf: 'flex-start' }} />
      <div className="relative w-full" style={{ height: 150, marginTop: 8 /* the tail stops just above D's head */ }}>
        {/* the shared soft floor */}
        <span aria-hidden="true" className="absolute pointer-events-none" style={{
          left: '4%', right: '4%', bottom: 0, height: 34, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(196,181,253,0.65), rgba(196,181,253,0) 72%)',
        }} />
        {/* One group, not two pictures: the cake stands IN FRONT of D (overlapping him), both on one contact shadow,
            and the candles throw a warm glow onto him (same as iOS / Android). */}
        <Contact left="29%" width="62%" bottom={0} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={castArt('d', season).src} alt="" aria-hidden="true" width={150} height={150} draggable={false}
          className="absolute select-none pointer-events-none" style={{ left: 'calc(70% - 71px)', bottom: 6, width: 142, height: 142, objectFit: 'contain' }} />
        <span aria-hidden="true" className="absolute pointer-events-none" style={{
          left: 'calc(47% - 46px)', bottom: 32, width: 92, height: 92, borderRadius: '50%', mixBlendMode: 'plus-lighter',
          background: 'radial-gradient(circle, rgba(255,199,89,0.55), rgba(255,199,89,0) 70%)',
        }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/age-check/cake.webp" alt="" aria-hidden="true" width={90} height={108} draggable={false}
          className="absolute select-none pointer-events-none" style={{ left: 'calc(47% - 42px)', bottom: 0, width: 84, height: 'auto', zIndex: 2, filter: 'drop-shadow(0 2px 4px rgba(76,29,149,0.25))' }} />
      </div>
    </div>
  );
}

const CAST_BACK = ['r', 'o2', 'c', 'u', 'i'] as const;
const CAST_FRONT = ['w', 'o1', 'd', 'o3', 's'] as const;

/** The kind scene for an under-13 answer: the lettered headline, a rainbow and the whole cast waving on one floor. */
function SeeYouScene() {
  const wave = (id: string, i: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={id} src={`/mascots/${id}.png`} alt="" aria-hidden="true" draggable={false}
      className="age-wave select-none pointer-events-none" style={{ width: '24%', marginLeft: i === 0 ? 0 : '-4%', ['--k' as string]: i } as React.CSSProperties} />
  );
  return (
    <div className="w-full flex flex-col items-center" style={{ maxWidth: 340 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/age-check/bunting.webp" alt="" aria-hidden="true" width={209} height={116} draggable={false} style={{ width: 190, height: 'auto' }} />
      <div className="w-full" style={{ marginTop: -62 }}>
        <BubbleText text="13 AND UP · SEE YOU SOON!" palette="home" maxSize={36} minSize={22} level={1} className="w-full" />
      </div>
      <div className="relative w-full" style={{ marginTop: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/age-check/rainbow.webp" alt="" aria-hidden="true" width={229} height={163} draggable={false}
          className="mx-auto select-none pointer-events-none" style={{ width: '70%', height: 'auto' }} />
        <div className="relative" style={{ marginTop: '-24%' }}>
          <span aria-hidden="true" className="absolute pointer-events-none" style={{
            left: '2%', right: '2%', bottom: -6, height: 44, borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(196,181,253,0.7), rgba(196,181,253,0) 72%)',
          }} />
          <div className="relative flex justify-center" style={{ paddingLeft: '3%', paddingRight: '3%' }}>{CAST_BACK.map(wave)}</div>
          <div className="relative flex justify-center" style={{ marginTop: '-9%', paddingLeft: '3%', paddingRight: '3%' }}>{CAST_FRONT.map((id, i) => wave(id, i + 5))}</div>
        </div>
      </div>
    </div>
  );
}

export function AgeCheckQuestion({ onAnswer }: { onAnswer: (year: number) => void }) {
  const years = useMemo(() => ageCheckYears(), []);
  const [year, setYear] = useState<number | null>(null);

  return (
    <PageBackground tint="home" scheme="light" className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-3 px-5 pt-3 pb-5">
        {/* the live WORDOCIOUS cast row stays on top; the question lives below it */}
        <div className="w-full"><CastHeader ground /></div>
        <AskScene />
        <YearWheel years={years} onPick={setYear} />
        <div className="w-full" style={{ marginTop: 2 }}>
          <CastButton color="purple" size="lg" block disabled={year == null} onClick={() => year != null && onAnswer(year)}>
            Continue
          </CastButton>
        </div>
      </div>
    </PageBackground>
  );
}

/** The kind screen for an under-13 answer. Nothing is created; the answer sticks on this device. */
export function AgeCheckUnder() {
  useEffect(() => {
    document.title = 'See you soon! | Wordocious';
  }, []);
  return (
    <PageBackground tint="home" scheme="light" className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-3 px-5 pt-3 pb-5 text-center">
        <div className="w-full"><CastHeader ground /></div>
        <h1 className="sr-only">Wordocious is for players 13 and up. See you soon!</h1>
        <SeeYouScene />
        <p className="font-bold" style={{ color: '#5b21b6', fontSize: 15, lineHeight: 1.35 }}>
          Wordocious is for players 13 and up. We would love to play with you when you are older!
        </p>
        <p className="font-semibold" style={{ color: 'rgba(76,29,149,0.7)', fontSize: 12 }}>
          Parents: questions or corrections? Write to{' '}
          <a href={`mailto:${AGE_CHECK_SUPPORT_EMAIL}`} className="font-bold underline">{AGE_CHECK_SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </PageBackground>
  );
}
