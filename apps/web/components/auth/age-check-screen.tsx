'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ageCheckYears, AGE_CHECK_SUPPORT_EMAIL } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { softBackground } from '@/lib/soft-surface';

// The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29). D (glasses + pencil) asks ONE question,
// "When's your birthday year?", on a year wheel with NO default and no hint that 13 matters; art is
// layered (docs/design/brand/2.8/agecheck: props from ChatGPT, canonical cast hero placed as is).
// The verdict, storage and server sync live in the caller (AgeGate) — this screen only collects a year.

const ROW = 54;
const VISIBLE = 5;

/** The year wheel: CSS scroll-snap, centered row picks. No row is selected until the player moves it. */
function YearWheel({ years, onPick }: { years: number[]; onPick: (year: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);
  const [index, setIndex] = useState(0);

  const pickIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(years.length - 1, i));
      setIndex(clamped);
      setTouched(true);
      onPick(years[clamped]);
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
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(touched ? index + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(touched ? index - 1 : 0); }
  };

  return (
    <div
      className="relative mx-auto"
      style={{
        width: 168,
        height: ROW * VISIBLE,
        borderRadius: 34,
        background: 'linear-gradient(180deg, rgba(196,181,253,0.55), rgba(233,213,255,0.85) 50%, rgba(196,181,253,0.55))',
        boxShadow: '0 10px 28px rgba(124,58,237,0.22), inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -3px 8px rgba(124,58,237,0.18)',
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
        aria-label="Birthday year"
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
        {years.map((y, i) => {
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
                color: on ? '#4c1d95' : 'rgba(109,40,217,0.5)',
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

export function AgeCheckQuestion({ onAnswer }: { onAnswer: (year: number) => void }) {
  const years = useMemo(() => ageCheckYears(), []);
  const [year, setYear] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto px-5 py-5"
      style={{ background: `linear-gradient(180deg, #eee4ff, #ffecf6), ${softBackground('#7c3aed', 0.07)}` }}
    >
      <div className="w-full max-w-sm my-auto flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/age-check/bunting.webp" alt="" width={209} height={116} style={{ width: 209, height: 'auto' }} draggable={false} />

        {/* D's speech bubble: the one question. */}
        <div
          className="w-full text-center"
          style={{
            marginTop: -34,
            padding: '30px 20px 24px',
            borderRadius: 34,
            background: 'linear-gradient(180deg, #f6efff, #e6d6ff)',
            boxShadow: '0 12px 30px rgba(124,58,237,0.2), inset 0 2px 0 rgba(255,255,255,0.9)',
          }}
        >
          <h1 className="font-black" style={{ color: '#5b21b6', fontSize: 28, lineHeight: 1.12 }}>
            When&apos;s your birthday year?
          </h1>
        </div>

        <YearWheel years={years} onPick={setYear} />

        <div className="w-full flex items-end justify-between mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/age-check/cake.webp" alt="" width={90} height={108} style={{ width: 90, height: 'auto' }} draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascots/d.png" alt="" width={150} height={150} style={{ width: 150, height: 150, objectFit: 'contain' }} draggable={false} />
        </div>

        <div className="w-full" style={{ marginTop: -6 }}>
          <CastButton color="purple" size="lg" block disabled={year == null} onClick={() => year != null && onAnswer(year)}>
            Continue
          </CastButton>
        </div>
      </div>
    </div>
  );
}

/** The kind screen for an under-13 answer. Nothing is created; the answer sticks on this device. */
export function AgeCheckUnder() {
  useEffect(() => {
    document.title = 'See you soon! | Wordocious';
  }, []);
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto px-5 py-5"
      style={{ background: 'linear-gradient(180deg, #e4ecff, #fdf1e4)' }}
    >
      <div className="w-full max-w-sm my-auto flex flex-col items-center gap-3 text-center">
        <h1 className="sr-only">Wordocious is for players 13 and up. See you soon!</h1>
        {/* The composed scene (headline lettering + the whole cast under a rainbow). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/age-check/under13.webp"
          alt="13 and up. See you soon! The Wordocious cast waves from under a rainbow."
          width={540}
          height={960}
          style={{ width: '100%', maxHeight: '72vh', objectFit: 'contain' }}
          draggable={false}
        />
        <p className="font-bold" style={{ color: '#5b21b6', fontSize: 15, lineHeight: 1.35 }}>
          Wordocious is for players 13 and up. We would love to play with you when you are older!
        </p>
        <p className="font-semibold" style={{ color: 'rgba(76,29,149,0.7)', fontSize: 12 }}>
          Parents: questions or corrections? Write to{' '}
          <a href={`mailto:${AGE_CHECK_SUPPORT_EMAIL}`} className="font-bold underline">{AGE_CHECK_SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}
