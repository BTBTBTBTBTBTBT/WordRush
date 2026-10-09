'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ageCheckYears, AGE_CHECK_SUPPORT_EMAIL } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { CastHeader } from '@/components/ui/cast-header';
import { BubbleText } from '@/components/ui/bubble-text';
import { useSeason } from '@/lib/season';
import { softBackground } from '@/lib/soft-surface';

// The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29). D (glasses + pencil) SAYS ONE question,
// "What year were you born?", in a comic speech bubble set in our bubble lettering, on a year wheel with NO default and
// no hint that 13 matters. The live WORDOCIOUS cast row stays at the top; below it D and the birthday cake stand on one
// soft floor as ONE scene (docs/design/brand/2.8/agecheck + bubbles: props from ChatGPT, canonical cast hero placed as is).
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

/** The comic speech bubble (tail toward D) with a line of bubble lettering inside. Halloween: the black-violet candy one. */
function SpeechBubble({ text, halloween, style }: { text: string; halloween: boolean; style?: React.CSSProperties }) {
  const aspect = halloween ? 401 / 327 : 398 / 295;
  return (
    <div className="relative" style={{ aspectRatio: String(aspect), ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={halloween ? '/age-check/bubble-halloween.webp' : '/age-check/bubble.webp'} alt="" aria-hidden="true" draggable={false}
        className="absolute inset-0 w-full h-full select-none pointer-events-none" />
      <div className="absolute flex items-center justify-center" style={{ left: '9%', right: '9%', top: '9%', bottom: halloween ? '29%' : '27%' }}>
        <BubbleText text={text} palette={halloween ? 'celebrate' : 'home'} maxSize={40} minSize={20} level={1} className="w-full" />
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
  const halloween = useSeason() !== null;
  return (
    <div className="w-full flex flex-col items-center" style={{ maxWidth: 340 }}>
      <SpeechBubble text="WHAT YEAR WERE YOU BORN?" halloween={halloween} style={{ width: '96%', alignSelf: 'flex-start' }} />
      <div className="relative w-full" style={{ height: 150, marginTop: -26 }}>
        {/* the shared soft floor */}
        <span aria-hidden="true" className="absolute pointer-events-none" style={{
          left: '4%', right: '4%', bottom: 0, height: 34, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(196,181,253,0.65), rgba(196,181,253,0) 72%)',
        }} />
        <Contact left="55%" width="38%" bottom={4} />
        <Contact left="12%" width="30%" bottom={0} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascots/d.png" alt="" aria-hidden="true" width={150} height={150} draggable={false}
          className="absolute select-none pointer-events-none" style={{ right: '6%', bottom: 4, width: 142, height: 142, objectFit: 'contain' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/age-check/cake.webp" alt="" aria-hidden="true" width={90} height={108} draggable={false}
          className="absolute select-none pointer-events-none" style={{ left: '20%', bottom: 0, width: 84, height: 'auto', zIndex: 2, filter: 'drop-shadow(0 3px 3px rgba(76,29,149,0.18))' }} />
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
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: `linear-gradient(180deg, #eee4ff, #ffecf6), ${softBackground('#7c3aed', 0.07)}` }}
    >
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
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, #e4ecff, #fdf1e4)' }}
    >
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
    </div>
  );
}
