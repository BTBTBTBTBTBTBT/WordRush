'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { VS } from '@/lib/vs-lobby';
import { BotAvatar } from './vs-ui';

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
}

export function VsQueueScreen({ modeName, othersWaiting, stepIn, searching, onPlayBot, onCancel, children }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [keepWaiting, setKeepWaiting] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!searching) return;
    const start = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching]);

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
  const frac = Math.min(1, elapsed / STEP_IN_SECONDS);
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
          <circle
            cx="66" cy="66" r="52" fill="none" stroke={VS.ink} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring * (1 - (stepIn ? frac : (elapsed % 60) / 60))}
            transform="rotate(-90 66 66)" style={{ transition: 'stroke-dashoffset 250ms linear' }}
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
              <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: VS.ink, transition: 'width 250ms linear' }} />
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
                onClick={() => setKeepWaiting(true)}
                className="flex-1 py-2.5 text-[12px] font-black"
                style={{ background: VS.soft, color: VS.ink, borderRadius: 11, letterSpacing: 0.5 }}
              >
                KEEP WAITING
              </button>
            )}
          </div>
        </div>
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
export function VsStartingScreen({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="max-w-sm w-full mx-auto px-5 text-center space-y-3">
      <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: VS.ink }} />
      <h1 className="text-[20px] font-black" style={{ color: VS.deep }}>{title}</h1>
      {sub && <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>{sub}</p>}
    </div>
  );
}
