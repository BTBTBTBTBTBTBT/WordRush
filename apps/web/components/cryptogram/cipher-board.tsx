'use client';

import { memo } from 'react';
import { CRYPTOGRAM_ALPHABET, cryptogramConflicts, cryptogramFrequencies, cryptogramPlainFor, type CryptogramState } from '@wordle-duel/core';

export const CRYPTOGRAM_ACCENT = '#92400e';
const HINT = '#8b5cf6';
const WRONG = '#dc2626';

interface CipherBoardProps {
  state: CryptogramState;
  selected: string | null;
  onSelect: (code: string) => void;
  finished: boolean;
}

/**
 * The saying as the player sees it (More Games §16): every letter is a Classic
 * style cell with the pencilled plain letter inside and the CODE letter in small
 * type beneath. Words never break across lines. The three given letters are
 * filled in the accent and locked; hinted letters are violet; a plain letter
 * used for two code letters reads red; the code letter just cleared by Check
 * flashes red. Tapping any cell selects its code letter everywhere.
 */
export const CipherBoard = memo(function CipherBoard({ state, selected, onSelect, finished }: CipherBoardProps) {
  const conflicts = new Set(cryptogramConflicts(state.mapping));
  const words = state.cipher.split(' ');
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 px-1 select-none" role="group" aria-label="Coded saying">
      {words.map((w, wi) => (
        <div key={wi} className="inline-flex items-end gap-[3px]">
          {[...w].map((ch, ci) => {
            if (!CRYPTOGRAM_ALPHABET.includes(ch)) {
              return <span key={ci} className="text-lg font-black pb-5 px-0.5" style={{ color: 'var(--color-text)' }}>{ch}</span>;
            }
            const plain = state.mapping[ch] ?? '';
            const locked = state.locked.includes(ch);
            const hinted = state.hinted.includes(ch);
            const isSel = selected === ch && !finished;
            const wrong = state.lastWrong.includes(ch);
            const conflict = plain !== '' && conflicts.has(plain) && !locked;
            const correct = finished && plain === cryptogramPlainFor(ch, state.key);
            let bg = 'var(--color-surface)', border = 'var(--color-border)', color = 'var(--color-text)';
            if (locked && hinted) { bg = HINT; border = HINT; color = '#fff'; }
            else if (locked && state.given.includes(plain)) { bg = CRYPTOGRAM_ACCENT; border = CRYPTOGRAM_ACCENT; color = '#fff'; }
            else if (locked) { bg = `${CRYPTOGRAM_ACCENT}22`; border = CRYPTOGRAM_ACCENT; color = CRYPTOGRAM_ACCENT; }
            else if (conflict || wrong) { border = WRONG; color = WRONG; }
            else if (finished && correct) { color = CRYPTOGRAM_ACCENT; }
            return (
              <button
                key={ci}
                type="button"
                onClick={() => onSelect(ch)}
                aria-label={`Code letter ${ch}${plain ? `, pencilled ${plain}` : ''}${locked ? ', locked' : ''}`}
                className={`flex flex-col items-center gap-0.5 ${wrong ? 'animate-shake' : ''}`}
              >
                <span
                  className="flex items-center justify-center rounded-md border-2 font-black text-base sm:text-lg w-7 h-8 sm:w-8 sm:h-9 transition-colors"
                  style={{ background: bg, borderColor: border, color, boxShadow: isSel ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${CRYPTOGRAM_ACCENT}` : undefined }}
                >
                  {plain}
                </span>
                <span className="text-[10px] font-extrabold leading-none" style={{ color: isSel ? CRYPTOGRAM_ACCENT : 'var(--color-text-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>{ch}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

interface FrequencyStripProps { state: CryptogramState; selected: string | null; onSelect: (code: string) => void }

/** Code letters by how often they occur, with the pencilled letter shown; tap to select. */
export const FrequencyStrip = memo(function FrequencyStrip({ state, selected, onSelect }: FrequencyStripProps) {
  const freq = cryptogramFrequencies(state.cipher);
  const codes = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
  return (
    <div className="flex flex-wrap justify-center gap-1 px-2" role="group" aria-label="Letter frequencies">
      {codes.map((c) => {
        const plain = state.mapping[c];
        const locked = state.locked.includes(c);
        const isSel = selected === c;
        return (
          <button key={c} type="button" onClick={() => onSelect(c)}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{ borderColor: isSel ? CRYPTOGRAM_ACCENT : 'var(--color-border)', color: locked ? CRYPTOGRAM_ACCENT : 'var(--color-text-muted)', background: isSel ? `${CRYPTOGRAM_ACCENT}12` : 'var(--color-surface)' }}
            aria-label={`Code letter ${c}, ${freq[c]} times${plain ? `, pencilled ${plain}` : ''}`}>
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{c}</span>
            <span className="opacity-70">{freq[c]}</span>
            {plain && <span className="font-black" style={{ color: locked ? CRYPTOGRAM_ACCENT : 'var(--color-text)' }}>→{plain}</span>}
          </button>
        );
      })}
    </div>
  );
});
