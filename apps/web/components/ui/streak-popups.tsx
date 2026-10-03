'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon } from 'lucide-react';
import { HeaderCircle } from '@/components/ui/page-header';
import { useExit } from '@/hooks/use-exit';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { ART_SIZE, artSrc, poseArt, type PoseArtName } from '@/lib/art';
import { softPill, softBackground } from '@/lib/soft-surface';
import { WEEK_LETTERS, streakWeek } from '@/lib/streak-week';
import { feedback } from '@/lib/sound-events';
import { EMPTY_STREAK_SUMMARY, flawlessRows, sweepRows, type StreakSummary } from '@/lib/streak-summary';

// The streak + shield popups (docs/FINISH_SPEC.md C5; mockup
// finishing-touches.html): little celebrations, not plain bubbles. A colored
// header (warm orange streak / purple shields / gold flawless) with the big 3D
// icon, a friendly headline and a host character (S the speedster cheers the
// streak, U the zen one guards the shields — A7: poses, not the header's
// heroes); Current + Best in two tinted soft-number tiles; the streak popup
// shows this week as seven day tiles; the shield popup a row of 3D shields
// (the next one to earn faded). AS6: the popup is portaled to <body> as a
// full-screen overlay — the scrim covers the whole page and the card sits
// centered (inside the header's clipped row it only shaded the strip). Escape
// or a tap outside closes it.

interface PopupShellProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name. */
  label: string;
  icon: Icon3DName;
  title: string;
  sub: string;
  host: PoseArtName;
  /** Header gradient. */
  header: string;
  /** The card's wash accent. */
  accent: string;
  children: React.ReactNode;
}

function PopupShell({ open, onClose, label, icon, title, sub, host, header, accent, children }: PopupShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  // FINISH_SPEC U: a popup opening = `whoosh`.
  useEffect(() => { if (open) feedback('whoosh'); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // AZ: a matching exit instead of vanishing in one frame.
  const { shown, leaving } = useExit(open);
  if (!shown || !mounted) return null;
  const [hw, hh] = ART_SIZE[host];
  return createPortal(
    <div className={`fixed inset-0 z-[60] flex items-center justify-center px-4 ${leaving ? 'motion-leaving' : ''}`} style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      {/* The whole page dims; a tap anywhere outside closes. */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'rgba(30, 15, 60, 0.45)' }} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="page-pop relative w-full max-w-sm overflow-y-auto soft-pop outline-none"
        style={{ maxHeight: '100%', borderRadius: 24, boxShadow: '0 18px 40px rgba(40, 15, 80, 0.35)', background: softBackground(accent, 0.08) }}
      >
        <div className="relative flex items-center gap-3" style={{ padding: '14px 16px 12px', paddingRight: 92, background: header }}>
          {/* BI12: an always-visible close on the card (the scrim also closes). */}
          <HeaderCircle label="Close" onClick={onClose} size={32} className="absolute top-1 right-1 z-10">
            <XIcon aria-hidden="true" style={{ width: 18, height: 18, color: '#fff' }} strokeWidth={3.2} />
          </HeaderCircle>
          <Icon3D name={icon} size={58} style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15))' }} />
          <div className="min-w-0">
            <h3 className="m-0 font-black text-white leading-tight" style={{ fontSize: 21, textShadow: '0 2px 0 rgba(0, 0, 0, 0.12)' }}>{title}</h3>
            <small className="block font-extrabold" style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.92)' }}>{sub}</small>
          </div>
          <Image
            src={artSrc(host)}
            alt=""
            aria-hidden="true"
            width={hw}
            height={hh}
            className="absolute pointer-events-none select-none"
            style={{ right: 8, bottom: -6, height: 78, width: 'auto' }}
          />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A tinted soft-number tile (Current / Best). */
function StatTile({ value, label, accent, ink }: { value: number; label: string; accent: string; ink: string }) {
  return (
    <div className="text-center" style={{ ...softPill(accent, { radius: 14 }), padding: '10px 10px 8px' }}>
      <SoftNum size={28} as="b" className="block soft-num-auto">{value}</SoftNum>
      <span className="font-black tint-ink" style={{ fontSize: 10, letterSpacing: '0.12em', color: ink }}>{label}</span>
    </div>
  );
}

const BLURB_STYLE: React.CSSProperties = { margin: 0, padding: '8px 16px 14px', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-secondary)', lineHeight: 1.45 };

export function StreakPopup({ open, onClose, streak, best, today, playedToday, summary = EMPTY_STREAK_SUMMARY, shields = 0 }: {
  open: boolean;
  onClose: () => void;
  streak: number;
  best: number;
  /** Local YYYY-MM-DD. */
  today: string;
  /** A daily is already done today (the run includes today). */
  playedToday: boolean;
  /** AS7: the sweep + flawless runs (the banner rows no longer show flames). */
  summary?: StreakSummary;
  shields?: number;
}) {
  const sweeps = sweepRows(summary);
  const flawless = flawlessRows(summary);
  const week = streakWeek(today, streak, playedToday);
  const isBest = streak > 0 && streak >= best;
  return (
    <PopupShell
      open={open}
      onClose={onClose}
      label={`Daily streak: ${streak} ${streak === 1 ? 'day' : 'days'}, best ${best}`}
      icon="flame"
      title={`${streak}-day streak!`}
      sub={isBest ? 'Your best ever. Keep it rolling.' : streak > 0 ? 'Keep it rolling.' : 'Play a daily to start one.'}
      host={poseArt('s', 'trophy')}
      header="linear-gradient(135deg, #ffb36b, #f5a524 60%, #ff8a5c)"
      accent="#f5a524"
    >
      <div className="grid grid-cols-2 gap-2" style={{ padding: '12px 14px 4px' }}>
        <StatTile value={streak} label="CURRENT" accent="#f5a524" ink="#a2560c" />
        <StatTile value={Math.max(best, streak)} label="BEST" accent="#f5a524" ink="#a2560c" />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" style={{ padding: '4px 14px 2px' }} aria-label="This week">
        {WEEK_LETTERS.map((d, i) => (
          <span key={i} className="font-black tint-ink" style={{ fontSize: 10, color: '#a2560c' }}>
            {d}
            <i
              className="grid place-items-center not-italic"
              aria-label={week[i] ? 'played' : 'not played'}
              style={{
                height: 26,
                marginTop: 2,
                borderRadius: 8,
                color: '#ffffff',
                ...(week[i]
                  ? { background: 'linear-gradient(#ffb36b, #f5a524)', boxShadow: '0 2px 0 #b0650b' }
                  : { background: 'rgba(255, 214, 160, 0.45)', border: '1.5px dashed rgba(217, 119, 6, 0.35)' }),
              }}
            >
              {week[i] ? '✓' : ''}
            </i>
          </span>
        ))}
      </div>
      <p style={{ ...BLURB_STYLE, paddingBottom: 6 }}>
        Play any daily puzzle each day to keep your streak going. Miss a day and it resets, unless a streak shield saves it.
      </p>

      {/* AS7: every other streak, labeled chips with soft numbers. Sweeps in the regular style… */}
      <SectionLabel color="#a2560c">Sweep streaks</SectionLabel>
      <div className="grid grid-cols-2 gap-2" style={{ padding: '0 14px 4px' }}>
        {sweeps.map((r) => (
          <StreakChip key={r.key} icon={<Icon3D name="flame" size={26} />} label={`${r.label} sweep`} current={r.current} best={r.best} accent="#7c3aed" ink="#5b21b6" />
        ))}
      </div>

      {/* …flawless runs in gold with the flawless star; a row shows once that run has ever happened. */}
      {flawless.length > 0 && (
        <>
          <SectionLabel color="#92400e">Flawless streaks</SectionLabel>
          <div className="grid gap-2" style={{ padding: '0 14px 4px', gridTemplateColumns: `repeat(${flawless.length}, minmax(0, 1fr))` }}>
            {flawless.map((r) => (
              <StreakChip
                key={r.key}
                gold
                icon={<Image src={artSrc('art-scene-flawless-star')} alt="" aria-hidden="true" width={28} height={32} sizes="28px" style={{ width: 26, height: 'auto' }} />}
                label={`${r.label} flawless`}
                current={r.current}
                best={r.best}
                accent="#f5a524"
                ink="#92400e"
              />
            ))}
          </div>
        </>
      )}

      {/* Shields: the count + how they work. */}
      <SectionLabel color="#5b21b6">Streak shields</SectionLabel>
      <div className="flex items-center gap-2.5" style={{ ...softPill('#7c3aed', { radius: 14 }), margin: '0 14px', padding: '8px 12px' }}>
        <Icon3D name="shield" size={30} />
        <SoftNum size={22} className="soft-num-auto">{shields}</SoftNum>
        <span className="font-extrabold leading-snug" style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
          A shield saves your streak on a missed day. Earn one at every 7-day milestone; Pro gets 4 each billing period.
        </span>
      </div>
      <div style={{ height: 14 }} />
    </PopupShell>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="font-black uppercase tint-ink" style={{ fontSize: 10.5, letterSpacing: '0.12em', color, padding: '8px 18px 4px' }}>{children}</div>
  );
}

/** A labeled streak chip: icon, label, the current run in soft numbers, best under it. */
function StreakChip({ icon, label, current, best, accent, ink, gold = false }: {
  icon: React.ReactNode; label: string; current: number; best: number | null; accent: string; ink: string; gold?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 min-w-0"
      style={{
        ...softPill(accent, { radius: 14 }),
        padding: '8px 10px',
        ...(gold ? { background: 'linear-gradient(180deg, #fff6d6, #ffe7a3)', boxShadow: 'inset 0 0 0 1.5px #f5c542, 0 2px 0 #e0a92a' } : null),
      }}
    >
      <span className="shrink-0 grid place-items-center" style={{ width: 30 }}>{icon}</span>
      <div className="min-w-0">
        <div className="font-black uppercase truncate tint-ink" style={{ fontSize: 9.5, letterSpacing: '0.08em', color: ink }}>{label}</div>
        <div className="flex items-baseline gap-1.5">
          <SoftNum size={20} className="soft-num-auto">{current}</SoftNum>
          {best != null && <span className="font-extrabold" style={{ fontSize: 10.5, color: ink }}>best {best}</span>}
        </div>
      </div>
    </div>
  );
}

/** How many shields the row draws before the faded "next" one. */
const SHIELD_ROW = 4;

export function ShieldPopup({ open, onClose, shields }: { open: boolean; onClose: () => void; shields: number }) {
  const shown = Math.min(shields, SHIELD_ROW);
  return (
    <PopupShell
      open={open}
      onClose={onClose}
      label={`Streak shields: ${shields}`}
      icon="shield"
      title={`${shields} streak shield${shields === 1 ? '' : 's'}`}
      sub={shields > 0 ? 'Your streak is protected.' : 'Earn one at every 7-day milestone.'}
      host={poseArt('u', 'lotus')}
      header="linear-gradient(135deg, #a78bfa, #7c3aed 60%, #6d28d9)"
      accent="#7c3aed"
    >
      <div className="flex justify-center items-center gap-2" style={{ padding: '12px 14px 2px' }} aria-hidden="true">
        {Array.from({ length: shown }).map((_, i) => <Icon3D key={i} name="shield" size={40} />)}
        <Icon3D name="shield" size={40} style={{ opacity: 0.28, filter: 'grayscale(1)' }} />
        {shields > SHIELD_ROW && <SoftNum size={20} className="soft-num-auto">+{shields - SHIELD_ROW}</SoftNum>}
      </div>
      <p style={BLURB_STYLE}>
        A shield saves your streak if you miss a day. Earn a free one at every 7-day milestone; Pro members get 4 each billing period.
      </p>
    </PopupShell>
  );
}

export function FlawlessPopup({ open, onClose, streak }: { open: boolean; onClose: () => void; streak: number }) {
  return (
    <PopupShell
      open={open}
      onClose={onClose}
      label={`Flawless streak: ${streak}`}
      icon="trophy"
      title={`${streak} flawless day${streak === 1 ? '' : 's'}`}
      sub="Every daily won, day after day."
      host={poseArt('o2', 'cheer')}
      header="linear-gradient(135deg, #ffd166, #f5a524 60%, #e8901a)"
      accent="#d97706"
    >
      <div className="grid grid-cols-1" style={{ padding: '12px 14px 4px' }}>
        <StatTile value={streak} label="STRAIGHT DAYS" accent="#d97706" ink="#92400e" />
      </div>
      <p style={BLURB_STYLE}>
        {streak} straight day{streak === 1 ? '' : 's'} winning every daily. Win every daily today to keep it alive.
      </p>
    </PopupShell>
  );
}
