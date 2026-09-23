'use client';

import { memo } from 'react';
import { Lightbulb, Eye } from 'lucide-react';
import { scrambleRemaining, scrambleTarget, scrambleTray, scrambleFinalOpen, SCRAMBLE_FINAL, type ScrambleState } from '@wordle-duel/core';

export const MUDDLE_ACCENT = '#f97316';
const PURPLE = '#7c3aed', LILAC = '#f5f3ff', LILAC_BORDER = '#c4b5fd', LILAC_TEXT = '#5b21b6', HINT = '#8b5cf6';
const COLS = 6;

/**
 * The cartoon panel (More Games §5/§8): a standard card in the cream paper
 * tone. Until the founder's image batch runs, a placeholder sketch stands in;
 * the caption is ALWAYS typeset by the app beneath the panel, never drawn.
 */
export const CartoonPanel = memo(function CartoonPanel({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="w-full max-w-md rounded-2xl border overflow-hidden" style={{ background: '#fdf8ec', borderColor: 'var(--color-border)', aspectRatio: '4 / 3' }} role="img" aria-label={alt}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/muddle/${src}`} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <svg viewBox="0 0 400 300" className="w-full h-full" aria-hidden>
          <rect x="0" y="0" width="400" height="300" fill="#fdf8ec" />
          <g fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="34" y="30" width="332" height="240" rx="18" strokeDasharray="10 8" opacity="0.35" />
            <path d="M120 215 Q200 120 280 215" />
            <circle cx="200" cy="130" r="34" />
            <path d="M186 124 q6 -8 12 0 M202 124 q6 -8 12 0" />
            <path d="M188 146 q12 12 24 0" />
          </g>
          <circle cx="300" cy="90" r="14" fill="#f97316" opacity="0.9" />
          <circle cx="100" cy="90" r="9" fill="#7c3aed" opacity="0.9" />
          <text x="200" y="262" textAnchor="middle" fontFamily="Nunito, system-ui, sans-serif" fontWeight="800" fontSize="14" fill="#6b7280">Cartoon panel — art batch pending</text>
        </svg>
      )}
    </div>
  );
});

interface WordRowProps {
  state: ScrambleState;
  row: number;
  active: boolean;
  shaking: boolean;
  onSelect: (row: number) => void;
  onTapTile: (row: number, letter: string) => void;
  onRevealLetter: (row: number) => void;
  onSolveWord: (row: number) => void;
  finished: boolean;
}

/**
 * One word (More Games §5, the classic newspaper layout): the scrambled
 * letters as bold spaced type, then the answer boxes directly beneath on ONE
 * fixed six-column grid (the sixth slot simply empty for a five-letter word).
 * A circled letter is a ring drawn INSIDE its box — white on a filled tile,
 * purple on an empty one — never an outline around the tile. Tapping a
 * scrambled letter places it; used letters dim.
 */
export const WordRow = memo(function WordRow({ state, row, active, shaking, onSelect, onTapTile, onRevealLetter, onSolveWord, finished }: WordRowProps) {
  const w = state.words[row];
  const entry = state.entries[row];
  const solved = state.solved[row];
  const remaining = scrambleRemaining(w.scramble, entry);
  const used = [...w.scramble];   // mark used letters left-to-right by multiset
  const left = [...remaining];
  const dimmed = used.map((ch) => { const k = left.indexOf(ch); if (k >= 0) { left.splice(k, 1); return false; } return true; });
  const circled = new Set(w.circled);
  const revealed = state.revealed[row];
  return (
    <div className={`w-full max-w-md flex flex-col gap-2 rounded-xl px-2 py-2 ${shaking ? 'animate-shake' : ''}`} style={{ background: active && !finished ? `${MUDDLE_ACCENT}0d` : undefined, border: `1.5px solid ${active && !finished ? `${MUDDLE_ACCENT}55` : 'transparent'}` }} onClick={() => !solved && !finished && onSelect(row)} role="group" aria-label={`Word ${row + 1}`}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2" aria-label={`Scrambled letters ${w.scramble.split('').join(' ')}`}>
          {[...w.scramble].map((ch, i) => (
            <button key={i} type="button" disabled={solved || finished || dimmed[i]} onClick={(e) => { e.stopPropagation(); onSelect(row); onTapTile(row, ch); }}
              className="font-black leading-none transition-opacity" style={{ fontSize: 'clamp(20px, 5.5vw, 26px)', color: 'var(--color-text)', opacity: dimmed[i] || solved ? 0.25 : 1, letterSpacing: 1 }}>
              {ch}
            </button>
          ))}
        </div>
        {!solved && !finished && (
          <div className="flex gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onRevealLetter(row); }} className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border" style={{ borderColor: `${MUDDLE_ACCENT}66`, color: MUDDLE_ACCENT, background: `${MUDDLE_ACCENT}0d` }} aria-label="Reveal a letter">
              <Lightbulb className="w-3 h-3" /> Letter
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onSolveWord(row); }} className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border" style={{ borderColor: `${MUDDLE_ACCENT}66`, color: MUDDLE_ACCENT, background: `${MUDDLE_ACCENT}0d` }} aria-label="Solve this word">
              <Eye className="w-3 h-3" /> Solve
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: COLS }, (_, i) => {
          if (i >= w.answer.length) return <span key={i} aria-hidden />;
          const ch = solved ? w.answer[i] : entry[i] ?? '';
          const filled = ch !== '';
          const pinned = revealed[i] !== '_';
          const ring = circled.has(i);
          const bg = solved ? PURPLE : filled ? (pinned ? HINT : PURPLE) : 'var(--color-surface)';
          const border = solved || filled ? bg : 'var(--color-border)';
          return (
            <span key={i} className="relative flex items-center justify-center rounded-lg border-2 font-black" style={{ aspectRatio: '1', maxHeight: 56, background: bg, borderColor: border, color: filled || solved ? '#fff' : 'var(--color-text)', fontSize: 'clamp(18px, 5vw, 26px)' }} aria-label={ring ? `${ch || 'empty'}, circled` : ch || 'empty'}>
              {ch}
              {ring && <span className="absolute rounded-full pointer-events-none" style={{ inset: 5, border: `2.5px solid ${filled || solved ? '#fff' : PURPLE}`, opacity: 0.9 }} aria-hidden />}
            </span>
          );
        })}
      </div>
    </div>
  );
});

interface FinalRowProps { state: ScrambleState; active: boolean; shaking: boolean; onSelect: () => void; onTapTile: (letter: string) => void; onRevealLetter: () => void; finished: boolean }

/** The punchline under a divider, grouped by word, in the light lilac tint with purple text; its tray is the circled letters in word order. */
export const FinalRow = memo(function FinalRow({ state, active, shaking, onSelect, onTapTile, onRevealLetter, finished }: FinalRowProps) {
  const open = scrambleFinalOpen(state);
  const entry = state.entries[SCRAMBLE_FINAL];
  const solved = state.solved[SCRAMBLE_FINAL];
  const target = scrambleTarget(state, SCRAMBLE_FINAL);
  const tray = scrambleTray(state, SCRAMBLE_FINAL);
  const remaining = scrambleRemaining(tray, entry);
  const left = [...remaining];
  const dimmed = [...tray].map((ch) => { const k = left.indexOf(ch); if (k >= 0) { left.splice(k, 1); return false; } return true; });
  let pos = 0;
  return (
    <div className={`w-full max-w-md flex flex-col gap-2 rounded-xl px-2 py-3 ${shaking ? 'animate-shake' : ''}`} style={{ borderTop: '1.5px solid var(--color-border)', background: active && !finished ? `${MUDDLE_ACCENT}0d` : undefined, opacity: open || finished ? 1 : 0.55 }} onClick={() => open && !solved && !finished && onSelect()} role="group" aria-label="Punchline">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>{open || finished ? 'The punchline' : 'Solve the four words to unlock the punchline'}</span>
        {open && !solved && !finished && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRevealLetter(); }} className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border" style={{ borderColor: `${MUDDLE_ACCENT}66`, color: MUDDLE_ACCENT, background: `${MUDDLE_ACCENT}0d` }} aria-label="Reveal a letter of the punchline">
            <Lightbulb className="w-3 h-3" /> Letter
          </button>
        )}
      </div>
      {open && !solved && !finished && (
        <div className="flex flex-wrap gap-2" aria-label="Circled letters">
          {[...tray].map((ch, i) => (
            <button key={i} type="button" disabled={dimmed[i]} onClick={(e) => { e.stopPropagation(); onSelect(); onTapTile(ch); }} className="font-black leading-none" style={{ fontSize: 'clamp(18px, 5vw, 24px)', color: LILAC_TEXT, opacity: dimmed[i] ? 0.25 : 1 }}>{ch}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {state.final.pattern.map((len, wi) => {
          const start = pos; pos += len;
          return (
            <div key={wi} className="flex gap-1.5">
              {Array.from({ length: len }, (_, k) => {
                const idx = start + k;
                const ch = solved || finished ? target[idx] : entry[idx] ?? '';
                const filled = ch !== '';
                return (
                  <span key={k} className="relative flex items-center justify-center rounded-lg border-2 font-black" style={{ width: 'clamp(30px, 8vw, 44px)', height: 'clamp(30px, 8vw, 44px)', background: filled ? LILAC : 'var(--color-surface)', borderColor: filled ? LILAC_BORDER : 'var(--color-border)', color: LILAC_TEXT, fontSize: 'clamp(16px, 4.4vw, 22px)' }}>
                    {ch}
                    <span className="absolute rounded-full pointer-events-none" style={{ inset: 4, border: `2px solid ${PURPLE}`, opacity: filled ? 0.9 : 0.35 }} aria-hidden />
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
