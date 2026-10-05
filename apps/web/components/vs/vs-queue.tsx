'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton } from '@/components/ui/candy-button';
import { CandySwitchTrack } from '@/components/ui/candy-switch';
import { CastButton } from '@/components/ui/cast-button';
import { VS, keepWaitingPingLine } from '@/lib/vs-lobby';
import { alphaHex } from '@/lib/soft-surface';
import { BotFigure, VS_ACCENT, VsCard, VsModeTile, vsCard } from './vs-ui';
import { CastLoader } from '@/components/ui/cast-loader';
import { HeadingArt } from '@/components/ui/heading-art';

// Live search (VS overhaul §6) — never a dead end. A ring timer counts up
// while we look for a person; a bot steps in at 0:15 unless the player taps
// KEEP WAITING (PLAY NOW stays). If a person joins first, they get the person.

export const STEP_IN_SECONDS = 15;

interface Props {
  /** "Classic", "QuadWord"… */
  modeName: string;
  /** Other players waiting in this mode (null until /vs/counts answers). */
  othersWaiting: number | null;
  /** The bot that steps in (a cast bot, drawn in its 'waiting' pose), or null when none should (a private match). */
  stepIn: { name: string; botId: string; color: string } | null;
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
      // Smoothness pass: the fill slides (transform) instead of growing its width (a layout per frame).
      if (barRef.current) barRef.current.style.transform = `translateX(${(stepFrac - 1) * 100}%)`;
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
          <circle cx="66" cy="66" r="52" fill={alphaHex(VS_ACCENT, 0.1)} stroke={VS.soft} strokeWidth="10" />
          {/* strokeDashoffset is animated per frame through ringRef (a constant
              prop here, so React never overwrites the live value). */}
          <circle
            ref={ringRef}
            cx="66" cy="66" r="52" fill="none" stroke={VS.ink} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring}
            transform="rotate(-90 66 66)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center"><SoftNum size={28}>{clock}</SoftNum></span>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-black" style={{ color: VS.ink, letterSpacing: 1.2 }}>SEARCHING</div>
        {/* BJ16: the FINDING A RIVAL lettering, not plain text. */}
        <HeadingArt slug="findingrival" as="h1" label="Looking for a rival" height={40} maxWidth={320} />
        <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>{waitingLine}</p>
      </div>

      {children}

      {stepIn && searching && (
        <VsCard accent={stepIn.color} className="text-left">
          <div className="p-4 pt-2 space-y-3">
            <div className="flex items-center gap-2">
              {/* The bot who steps in, waiting in character (D3). */}
              <BotFigure id={stepIn.botId} pose="waiting" size={64} />
              <div className="min-w-0">
                <div className="text-[14px] font-black" style={{ color: VS.deep }}>
                  {keepWaiting ? 'We’ll keep looking' : `${stepIn.name} steps in at 0:${String(STEP_IN_SECONDS).padStart(2, '0')}`}
                </div>
                <div className="text-[11.5px] font-bold" style={{ color: '#4b5563' }}>If a person joins first, you get them.</div>
              </div>
            </div>
            {!keepWaiting && (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: alphaHex(stepIn.color, 0.18) }}>
                <div
                  ref={(el) => {
                    barRef.current = el;
                    // Mount at the live position (no jump from 0 on first paint).
                    if (el) el.style.transform = `translateX(${(Math.min(1, elapsedMsRef.current / (STEP_IN_SECONDS * 1000)) - 1) * 100}%)`;
                  }}
                  className="h-full w-full rounded-full"
                  style={{ background: stepIn.color }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <CastButton screen="blue" color="teal" size="md" className="flex-1" icon="play" onClick={() => { firedRef.current = true; onPlayBot(); }}>
                Play {stepIn.name} now
              </CastButton>
              {!keepWaiting && (
                <CandyButton
                  color="peach"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setKeepWaiting(true);
                    looking?.ping().then((r) => setPingLine(keepWaitingPingLine(r))).catch(() => {});
                  }}
                >
                  Keep waiting
                </CandyButton>
              )}
            </div>
            {keepWaiting && pingLine && (
              <div className="text-[11.5px] font-bold text-center" style={{ color: VS.deep }}>{pingLine}</div>
            )}
          </div>
        </VsCard>
      )}

      {looking && searching && (
        <button
          type="button"
          role="switch"
          aria-checked={looking.on}
          onClick={looking.onToggle}
          disabled={looking.saving}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          style={{ ...vsCard(VS_ACCENT, { radius: 16, selected: looking.on }), opacity: looking.saving ? 0.6 : 1 }}
        >
          <Icon3D name="bell" size={20} />
          <span className="flex-1 min-w-0 text-[12.5px] font-extrabold" style={{ color: VS.deep }}>{looking.label}</span>
          {/* The candy switch (family rule: every on/off switch is the candy toggle). */}
          <CandySwitchTrack checked={looking.on} standalone />
        </button>
      )}

      <div className="flex justify-center">
        <CandyButton color="peach" size="sm" onClick={onCancel} icon={<X className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={3} />}>Cancel</CandyButton>
      </div>
    </div>
  );
}

/** The short beat before a bot / race / challenge-send game starts (no live search). */
export function VsStartingScreen({ title, sub, mode, figure }: {
  title: string; sub?: string; mode?: string;
  /** Who you are about to play (a bot in its pose, Your Ghost's faded tile) in place of the cast loader. */
  figure?: React.ReactNode;
}) {
  return (
    <div className="max-w-sm w-full mx-auto px-5 text-center flex flex-col items-center gap-3">
      {mode && <VsModeTile mode={mode} size={48} icon={24} />}
      {figure ?? <CastLoader />}
      <h1 className="text-[20px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.4 }}>{title}</h1>
      {sub && <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>{sub}</p>}
    </div>
  );
}
