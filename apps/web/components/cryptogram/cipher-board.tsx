'use client';

import { memo, type ReactNode } from 'react';
import { CRYPTOGRAM_ALPHABET, cryptogramConflicts, cryptogramFrequencies, cryptogramPlainFor, type CryptogramState } from '@wordle-duel/core';
import { cipherMetrics, wrapCipherWords, CIPHER_CELL_MIN } from './cipher-layout';

export const CRYPTOGRAM_ACCENT = '#92400e';
const HINT = '#8b5cf6';
const WRONG = '#dc2626';
const MONO = 'ui-monospace, Menlo, monospace';

interface CipherBoardProps {
  state: CryptogramState;
  selected: string | null;
  onSelect: (code: string) => void;
  finished: boolean;
  /** Cell side in px (§16 layout rule: 64 down to 40, fitted to the band). */
  cell?: number;
  /**
   * Available width in px. When known, the board draws exactly the lines
   * `wrapCipherWords` measured for the fit; when unknown (results view, first
   * frame) it falls back to a flex wrap of whole words.
   */
  width?: number | null;
}

/**
 * The saying as the player sees it (More Games §16): every letter is a Classic
 * style cell with the penciled plain letter inside and the CODE letter in small
 * type beneath. Words never break across lines. The three given letters are
 * filled in the accent and locked; hinted letters are violet; a plain letter
 * used for two code letters reads red; the code letter just cleared by Check
 * flashes red. Tapping any cell selects its code letter everywhere. The cell
 * side, the code letter and every gap scale together from `cell`.
 */
export const CipherBoard = memo(function CipherBoard({ state, selected, onSelect, finished, cell = CIPHER_CELL_MIN, width = null }: CipherBoardProps) {
  const conflicts = new Set(cryptogramConflicts(state.mapping));
  const m = cipherMetrics(cell);
  const plainFont = Math.round(cell * 0.45);

  const renderWord = (w: string, key: string | number): ReactNode => (
    <div key={key} className="inline-flex items-end shrink-0" style={{ gap: m.cellGap }}>
      {[...w].map((ch, ci) => {
        if (!CRYPTOGRAM_ALPHABET.includes(ch)) {
          return (
            <span key={ci} className="font-black text-center" style={{ color: 'var(--color-text)', width: m.punctWidth, fontSize: Math.round(cell * 0.5), paddingBottom: m.codeGap + m.codeFont }}>
              {ch}
            </span>
          );
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
            className={`flex flex-col items-center ${wrong ? 'animate-shake' : ''}`}
            style={{ gap: m.codeGap }}
          >
            <span
              className="flex items-center justify-center rounded-md border-2 font-black transition-colors"
              style={{ width: cell, height: cell, fontSize: plainFont, background: bg, borderColor: border, color, boxShadow: isSel ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${CRYPTOGRAM_ACCENT}` : undefined }}
            >
              {plain}
            </span>
            <span className="font-extrabold leading-none" style={{ fontSize: m.codeFont, color: isSel ? CRYPTOGRAM_ACCENT : 'var(--color-text-muted)', fontFamily: MONO }}>{ch}</span>
          </button>
        );
      })}
    </div>
  );

  if (width == null) {
    return (
      <div className="flex flex-wrap justify-center px-1 select-none" role="group" aria-label="Coded saying" style={{ columnGap: m.wordGap, rowGap: m.rowGap }}>
        {state.cipher.split(' ').map((w, wi) => renderWord(w, wi))}
      </div>
    );
  }

  const lines = wrapCipherWords(state.cipher, cell, width);
  return (
    <div className="flex flex-col items-center select-none" role="group" aria-label="Coded saying" style={{ gap: m.rowGap }}>
      {lines.map((line, li) => (
        <div key={li} className="flex justify-center" style={{ gap: m.wordGap }}>
          {line.map((w, wi) => renderWord(w, `${li}-${wi}`))}
        </div>
      ))}
    </div>
  );
});

interface FrequencyStripProps {
  state: CryptogramState;
  selected: string | null;
  onSelect: (code: string) => void;
  /** Chip type size in px, scaled with the cell (14 at the top end, 11 at the floor). */
  chipFont?: number;
}

/** Code letters by how often they occur, with the penciled letter shown; tap to select. */
export const FrequencyStrip = memo(function FrequencyStrip({ state, selected, onSelect, chipFont = 11 }: FrequencyStripProps) {
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
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold"
            style={{ fontSize: chipFont, borderColor: isSel ? CRYPTOGRAM_ACCENT : 'var(--color-border)', color: locked ? CRYPTOGRAM_ACCENT : 'var(--color-text-muted)', background: isSel ? `${CRYPTOGRAM_ACCENT}12` : 'var(--color-surface)' }}
            aria-label={`Code letter ${c}, ${freq[c]} times${plain ? `, pencilled ${plain}` : ''}`}>
            <span style={{ fontFamily: MONO }}>{c}</span>
            <span className="opacity-70">{freq[c]}</span>
            {plain && <span className="font-black" style={{ color: locked ? CRYPTOGRAM_ACCENT : 'var(--color-text)' }}>→{plain}</span>}
          </button>
        );
      })}
    </div>
  );
});
