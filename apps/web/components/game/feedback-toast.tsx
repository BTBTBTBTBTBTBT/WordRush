'use client';

import { useId, type CSSProperties } from 'react';
import { feedbackKind, type FeedbackTone } from '@/lib/feedback-toast';
import { alphaHex, SOFT_INK, softMix } from '@/lib/soft-surface';

// The finished in-game feedback popup (founder 10-02: "the +5 needs to be
// engaging as a colorful graphic, perhaps a small animation"). ONE component
// for every game's flash line; lib/feedback-toast.ts classifies the text:
//  · SCORE ("+5", "Pangram! +14") → a glossy gold candy pill (rainbow for a
//    pangram) with a gradient star, a big outlined "+5", the quality label
//    ("Nice!") and four sparkles that burst once.
//  · MESSAGE → a calm candy pill in its tone's wash with a glossy 3D coin
//    (X / check / star / moon / ! / sparkle) — never the generic "i".
// Motion is transform + opacity keyframes only (globals.css `ft-*`); Reduce
// Motion (OS or the in-app toggle) turns it into a plain fade, no sparkles.
// Placement: <FeedbackToast/> is absolute + pointer-events-none, centered over
// its `position: relative` anchor (an entry line, the meta row under the
// title), so it never shifts layout and never sits on the title art or board.

/** Tone accents (success green, error coral, win purple, loss slate, warn gold, info purple). */
export const FEEDBACK_TONE_ACCENT: Record<FeedbackTone, string> = {
  success: '#059669',
  error: '#f43f5e',
  win: '#7c3aed',
  loss: '#64748b',
  warn: '#f5a524',
  info: '#8b5cf6',
};

/** The dark-purple outline / ink on the candy burst. */
const OUTLINE = '#3C1E6E';
const OUTLINED_TEXT: CSSProperties = {
  color: '#fff',
  textShadow: `0 2px 0 ${OUTLINE}, 1px 0 0 ${OUTLINE}, -1px 0 0 ${OUTLINE}, 0 -1px 0 ${OUTLINE}, 1px 1px 0 ${OUTLINE}, -1px 1px 0 ${OUTLINE}`,
};

const RAINBOW = 'linear-gradient(90deg, #FF6FB5, #FFB547, #FFE45C, #5EE0A0, #6FA8FF, #A77BFF)';
const GOLD = 'linear-gradient(180deg, #FFE27A, #F5A524)';

// Sparkles burst from the pill center at ~30 / 150 / 210 / 330 deg, ~32 px out.
const SPARKS: { dx: number; dy: number; size: number; color: string }[] = [
  { dx: 28, dy: -16, size: 5, color: '#fff' },
  { dx: -28, dy: -16, size: 4, color: '#FFE45C' },
  { dx: -28, dy: 16, size: 5, color: '#fff' },
  { dx: 28, dy: 16, size: 4, color: '#FFE45C' },
];

function GoldStar({ size }: { size: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="shrink-0 relative">
      <defs>
        <linearGradient id={`ftstar${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF1A8" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path d="M12 2.3l2.95 6.05 6.65.85-4.88 4.6 1.25 6.6L12 17.2l-5.97 3.2 1.25-6.6L2.4 9.2l6.65-.85z"
        fill={`url(#ftstar${id})`} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

const GLYPH: Record<FeedbackTone, React.ReactNode> = {
  error: <path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" fill="none" />,
  success: <path d="M7.6 12.4l3 3 5.8-6.3" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  win: <path d="M12 6.6l1.65 3.35 3.7.52-2.68 2.6.63 3.68L12 15.02l-3.3 1.73.63-3.68-2.68-2.6 3.7-.52z" fill="#fff" />,
  loss: <path d="M14.6 6.9a5.4 5.4 0 1 0 2.9 9.4 4.4 4.4 0 0 1-2.9-9.4z" fill="#fff" />,
  warn: <><path d="M12 7.2v5.6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" /><circle cx="12" cy="16.4" r="1.4" fill="#fff" /></>,
  info: <path d="M12 6.3c.5 3.1 2.5 5.1 5.6 5.7-3.1.5-5.1 2.5-5.6 5.7-.5-3.2-2.5-5.2-5.6-5.7 3.1-.6 5.1-2.6 5.6-5.7z" fill="#fff" />,
};

/** The glossy 3D coin for a message tone (22 px). */
export function FeedbackCoin({ tone, size = 22 }: { tone: FeedbackTone; size?: number }) {
  const id = useId().replace(/:/g, '');
  const accent = FEEDBACK_TONE_ACCENT[tone];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <defs>
        <linearGradient id={`ftcoin${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={softMix(accent, 0.45)} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.6" fill={`url(#ftcoin${id})`} stroke="#fff" strokeWidth={1.5} />
      <ellipse cx="12" cy="6.6" rx="5.6" ry="2.4" fill="#fff" opacity={0.42} />
      {GLYPH[tone]}
    </svg>
  );
}

function ScoreBurst({ points, pangram, label }: { points: number; pangram: boolean; label: string }) {
  const k = pangram ? 1.15 : 1;
  return (
    <span className="ft-score relative inline-flex items-center rounded-full whitespace-nowrap"
      style={{
        background: pangram ? RAINBOW : GOLD,
        border: '2.5px solid #fff',
        boxShadow: `0 3px 0 ${pangram ? '#7C3AED' : '#D97706'}`,
        padding: `${4 * k}px ${14 * k}px ${4 * k}px ${8 * k}px`,
        gap: 6 * k,
      }}>
      {/* The static gloss across the top third. */}
      <span aria-hidden="true" className="absolute rounded-full pointer-events-none"
        style={{ left: 8, right: 8, top: 2, height: '36%', background: 'linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.08))' }} />
      <GoldStar size={Math.round(24 * k)} />
      <span className="relative font-black leading-none" style={{ ...OUTLINED_TEXT, fontSize: 24 * k }}>+{points}</span>
      <span className="relative font-black leading-none" style={{ ...OUTLINED_TEXT, fontSize: pangram ? 15 : 13, letterSpacing: pangram ? '0.02em' : undefined }}>{label}</span>
      {SPARKS.map((s, i) => (
        <span key={i} aria-hidden="true" className="ft-spark absolute rounded-full pointer-events-none"
          style={{ left: '50%', top: '50%', width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2, background: s.color,
            ['--ft-dx' as string]: `${Math.round(s.dx * k)}px`, ['--ft-dy' as string]: `${Math.round(s.dy * k)}px` } as CSSProperties} />
      ))}
    </span>
  );
}

function MessagePill({ text, tone }: { text: string; tone: FeedbackTone }) {
  const accent = FEEDBACK_TONE_ACCENT[tone];
  return (
    <span className="ft-msg inline-flex">
      <span className={`${tone === 'error' ? 'ft-shake ' : ''}inline-flex items-center gap-1.5 rounded-full font-black leading-tight text-center`}
        style={{
          background: `linear-gradient(180deg, ${alphaHex(accent, 0.08)}, ${alphaHex(accent, 0.2)}), var(--color-card-base, #ffffff)`,
          border: `1.5px solid ${alphaHex(accent, 0.45)}`,
          boxShadow: `0 2px 0 ${alphaHex(accent, 0.35)}`,
          color: SOFT_INK.num,
          fontSize: 13,
          padding: '4px 13px 4px 5px',
          maxWidth: 'min(92vw, 420px)',
        }}>
        <FeedbackCoin tone={tone} />
        <span className="min-w-0">{text}</span>
      </span>
    </span>
  );
}

/** The bare popup (no positioning): a score burst or a tone message. Re-key it on the message to replay. */
export function FeedbackPill({ message, tone }: { message: string; /** Overrides the classified tone of a message. */ tone?: FeedbackTone }) {
  const k = feedbackKind(message);
  return k.kind === 'score'
    ? <ScoreBurst points={k.points} pangram={k.pangram} label={k.label} />
    : <MessagePill text={k.text} tone={tone ?? k.tone} />;
}

/**
 * The positioned toast: absolute, pointer-events-none, centered over its
 * `position: relative` anchor (or at `top` inside it). Renders nothing for an
 * empty message. `seq` bumps on every flash so a repeated "+5" replays.
 */
export function FeedbackToast({ message, seq, tone, top, className = '' }: {
  message: string | null | undefined;
  seq?: number;
  /** Overrides the classified tone of a message (e.g. 'warn'). */
  tone?: FeedbackTone;
  /** A fixed top inside the anchor instead of centering over it. */
  top?: string | number;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite"
      className={`absolute left-0 right-0 z-30 flex justify-center pointer-events-none ${top == null ? 'inset-y-0 items-center' : ''} ${className}`}
      style={top == null ? undefined : { top }}>
      <FeedbackPill key={`${seq ?? 0}|${message}`} message={message} tone={tone} />
    </div>
  );
}
