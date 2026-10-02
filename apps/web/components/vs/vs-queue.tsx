'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { VS, keepWaitingPingLine } from '@/lib/vs-lobby';
import { BotAvatar, VsModeIcon, VsRingSpinner } from './vs-ui';

// Live search (VS overhaul §6) — never a dead end. A ring timer counts up
// while we look for a person; a bot steps in at 0:15 unless the player taps
// KEEP WAITING (PLAY NOW stays). If a person joins first, they get the person.

export const STEP_IN_SECONDS = 15;

interface Props {
  /** "Classic", "QuadWord"… */
  modeName: string;
  /** Other players waiting in this mode (null until /vs/counts answers). */
  othersWaiting: number | null;
  /** The bot that steps in, or null when none should (a private match). */
  stepIn: { name: string; art: string } | null;
  /** False once a match is found (the intro is up) — the timer and card stop. */
  searching: boolean;
  onPlayBot: () => void;
  onCancel: () => void;
  /** Extra content under the headline (the private-match share card). */
  children?: React.ReactNode;
  /**
   * "Ping me when someone's looking" (§13) — Pro, live random queue only: the
   * switch row under the step-in card, and KEEP WAITING pings the opted-in.
   */
  looking?: {
    label: string;
    on: boolean;
    saving: boolean;
    onToggle: () => void;
    ping: () => Promise<{ pinged: number; throttled: boolean } | null>;
  };
}

export function VsQueueScreen({ modeName, othersWaiting, stepIn, searching, onPlayBot, onCancel, children, looking }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [keepWaiting, setKeepWaiting] = useState(false);
  const [pingLine, setPingLine] = useState<string | null>(null);
  const firedRef = useRef(false);
  // Fluid timer motion (founder, 2026-10-01: the 15 s step-in countdown was
  // choppy): the ring and the step-in bar are driven every animation frame
  // from the exact elapsed milliseconds, written straight to the DOM (no
  // re-render per frame). Only the digits tick once a second.
  const elapsedMsRef = useRef(0);
  const ringRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hasStepIn = !!stepIn;

  useEffect(() => {
    if (!searching) return;
    const start = Date.now() - elapsedMsRef.current;
    const ringLen = 2 * Math.PI * 52;
    let raf = 0;
    const frame = () => {
      const ms = Date.now() - start;
      elapsedMsRef.current = ms;
      const stepFrac = Math.min(1, ms / (STEP_IN_SECONDS * 1000));
      const ringFrac = hasStepIn ? stepFrac : (ms % 60000) / 60000;
      ringRef.current?.setAttribute('stroke-dashoffset', String(ringLen * (1 - ringFrac)));
      if (barRef.current) barRef.current.style.width = `${stepFrac * 100}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, [searching, hasStepIn]);

  // At 0:15 the bot match starts on its own, unless KEEP WAITING was tapped.
  useEffect(() => {
    if (!searching || !stepIn || keepWaiting || firedRef.current) return;
    if (elapsed >= STEP_IN_SECONDS) {
      firedRef.current = true;
      onPlayBot();
    }
  }, [elapsed, searching, stepIn, keepWaiting, onPlayBot]);

  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const ring = 2 * Math.PI * 52;
  const waitingLine = othersWaiting === null
    ? `Searching ${modeName}`
    : othersWaiting > 0
    ? `${othersWaiting} waiting in ${modeName}`
    : `Nobody else is waiting in ${modeName} right now`;

  return (
    <div className="max-w-sm w-full mx-auto px-5 text-center space-y-5">
      <div className="relative mx-auto" style={{ width: 132, height: 132 }}>
        <span className="absolute inset-3 rounded-full animate-ping" style={{ background: VS.soft, opacity: 0.6 }} />
        <svg width="132" height="132" viewBox="0 0 132 132" className="relative">
          <circle cx="66" cy="66" r="52" fill="#ffffff" stroke={VS.soft} strokeWidth="10" />
          {/* strokeDashoffset is animated per frame through ringRef (a constant
              prop here, so React never overwrites the live value). */}
          <circle
            ref={ringRef}
            cx="66" cy="66" r="52" fill="none" stroke={VS.ink} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring}
            transform="rotate(-90 66 66)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[26px] font-black" style={{ color: VS.deep }}>{clock}</span>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-black" style={{ color: VS.ink, letterSpacing: 1.2 }}>SEARCHING</div>
        <h1 className="text-[22px] font-black" style={{ color: VS.deep }}>LOOKING FOR A RIVAL</h1>
        <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>{waitingLine}</p>
      </div>

      {children}

      {stepIn && searching && (
        <div className="p-4 space-y-3 text-left" style={{ background: '#ffffff', borderRadius: 14, boxShadow: VS.cardShadow }}>
          <div className="flex items-center gap-3">
            <BotAvatar src={stepIn.art} name={stepIn.name} size={44} bg={VS.soft} />
            <div className="min-w-0">
              <div className="text-[14px] font-black" style={{ color: VS.deep }}>
                {keepWaiting ? 'We’ll keep looking' : `${stepIn.name} steps in at 0:${String(STEP_IN_SECONDS).padStart(2, '0')}`}
              </div>
              <div className="text-[11.5px] font-bold" style={{ color: '#4b5563' }}>If a person joins first, you get them.</div>
            </div>
          </div>
          {!keepWaiting && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: VS.soft }}>
              <div
                ref={(el) => {
                  barRef.current = el;
                  // Mount at the live position (no jump from 0 on first paint).
                  if (el) el.style.width = `${Math.min(1, elapsedMsRef.current / (STEP_IN_SECONDS * 1000)) * 100}%`;
                }}
                className="h-full rounded-full"
                style={{ background: VS.ink }}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { firedRef.current = true; onPlayBot(); }}
              className="flex-1 py-2.5 text-[12px] font-black text-white uppercase"
              style={{ background: VS.ink, borderRadius: 11, letterSpacing: 0.5 }}
            >
              Play {stepIn.name} now
            </button>
            {!keepWaiting && (
              <button
                type="button"
                onClick={() => {
                  setKeepWaiting(true);
                  looking?.ping().then((r) => setPingLine(keepWaitingPingLine(r))).catch(() => {});
                }}
                className="flex-1 py-2.5 text-[12px] font-black"
                style={{ background: VS.soft, color: VS.ink, borderRadius: 11, letterSpacing: 0.5 }}
              >
                KEEP WAITING
              </button>
            )}
          </div>
          {keepWaiting && pingLine && (
            <div className="text-[11.5px] font-bold text-center" style={{ color: VS.deep }}>{pingLine}</div>
          )}
        </div>
      )}

      {looking && searching && (
        <button
          type="button"
          role="switch"
          aria-checked={looking.on}
          onClick={looking.onToggle}
          disabled={looking.saving}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          style={{ background: '#ffffff', borderRadius: 14, boxShadow: VS.cardShadow, opacity: looking.saving ? 0.6 : 1 }}
        >
          <Bell className="w-4 h-4 shrink-0" style={{ color: VS.ink }} />
          <span className="flex-1 min-w-0 text-[12.5px] font-extrabold" style={{ color: VS.deep }}>{looking.label}</span>
          <span
            className="relative shrink-0 rounded-full transition-colors"
            style={{ width: 36, height: 20, background: looking.on ? VS.ink : '#d1d5db' }}
            aria-hidden="true"
          >
            <span className="absolute rounded-full bg-white transition-all" style={{ top: 2, width: 16, height: 16, left: looking.on ? 18 : 2 }} />
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mx-auto flex items-center gap-1.5 px-5 py-2 text-[13px] font-black"
        style={{ color: VS.label }}
      >
        <X className="w-4 h-4" /> Cancel
      </button>
    </div>
  );
}

/** The short beat before a bot / race / challenge-send game starts (no live search). */
export function VsStartingScreen({ title, sub, mode }: { title: string; sub?: string; mode?: string }) {
  return (
    <div className="max-w-sm w-full mx-auto px-5 text-center flex flex-col items-center gap-3">
      {mode && (
        <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: '#ffffff', boxShadow: VS.cardShadow }}>
          <VsModeIcon mode={mode} size={24} />
        </span>
      )}
      <VsRingSpinner />
      <h1 className="text-[20px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.4 }}>{title}</h1>
      {sub && <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>{sub}</p>}
    </div>
  );
}
