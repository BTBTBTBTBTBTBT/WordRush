'use client';

import { memo, useRef, type CSSProperties, type ReactNode } from 'react';
import { CRYPTOGRAM_ALPHABET, cryptogramConflicts, cryptogramFrequencies, cryptogramPlainFor, type CryptogramState } from '@wordle-duel/core';
import { cipherMetrics, wrapCipherWords, CIPHER_CELL_MIN } from './cipher-layout';
import { GameTray } from '@/components/ui/game-tray';
import { cipherCellLook, glossyChip, lockFlipDelay, trayChrome } from '@/lib/puzzle-look';
import { accentInk, alphaHex, darken, softBackground, softBorder } from '@/lib/soft-surface';

export const CRYPTOGRAM_ACCENT = '#92400e';
const MONO = 'ui-monospace, Menlo, monospace';
/** The tray's inner padding (px); the game's band fit takes CIPHER_TRAY_CHROME off the band first. */
export const CIPHER_TRAY_PAD = 10;
export const CIPHER_TRAY_CHROME = trayChrome(CIPHER_TRAY_PAD);
/** The code letter's chip ink: the accent's deep ink on the light wash, a light amber on the dark theme. */
const CODE_INK = accentInk(CRYPTOGRAM_ACCENT);

interface CipherBoardProps {
  state: CryptogramState;
  selected: string | null;
  onSelect: (code: string) => void;
  finished: boolean;
  /** Cell side in px (§16 layout rule: 64 down to 40, fitted to the band). */
  cell?: number;
  /**
   * Available width in px (inside the tray). When known, the board draws
   * exactly the lines `wrapCipherWords` measured for the fit; when unknown
   * (results view, first frame) it falls back to a flex wrap of whole words.
   */
  width?: number | null;
}

interface CodeMotion { kind: 'lock' | 'hint'; delay: number; seq: number }

/**
 * The saying as the player sees it (More Games §16), on the shared game tray
 * (FINISH_SPEC L): every letter is a B1 glossy tile (J3) with the penciled
 * plain letter inside and the CODE letter as a small chip beneath. Words never
 * break across lines. The three given letters are plain light "given" tiles;
 * checked-right letters purple (they turn over as a Check locks them); hinted
 * letters the hint violet (gold glow as they land); a plain letter used for two
 * code letters reads red, and the code letter just cleared by Check flashes red
 * with a shake. Tapping any cell selects its code letter everywhere (an accent
 * ring + a filled code chip). The cell side, the chip and every gap scale
 * together from `cell`.
 */
export const CipherBoard = memo(function CipherBoard({ state, selected, onSelect, finished, cell = CIPHER_CELL_MIN, width = null }: CipherBoardProps) {
  const conflicts = new Set(cryptogramConflicts(state.mapping));
  const m = cipherMetrics(cell);
  const plainFont = Math.round(cell * 0.45);

  // Code letters that just locked (a Check) or were hinted, kept per code with a
  // sequence number that remounts their tiles so each plays once; a board that
  // mounts (a restored save, the finished recap) plays nothing.
  const prevRef = useRef<{ seed: string; locked: string[] } | null>(null);
  const motionRef = useRef<Map<string, CodeMotion>>(new Map());
  const seqRef = useRef(0);
  const prev = prevRef.current;
  if (!prev || prev.seed !== state.seed) {
    motionRef.current = new Map();
  } else if (prev.locked !== state.locked) {
    const before = new Set(prev.locked);
    const added = state.locked.filter((c) => !before.has(c)).sort((a, b) => state.cipher.indexOf(a) - state.cipher.indexOf(b));
    let k = 0;
    for (const c of added) {
      if (state.hinted.includes(c)) motionRef.current.set(c, { kind: 'hint', delay: 0, seq: ++seqRef.current });
      else motionRef.current.set(c, { kind: 'lock', delay: lockFlipDelay(k++), seq: ++seqRef.current });
    }
  }
  prevRef.current = { seed: state.seed, locked: state.locked };
  const motions = motionRef.current;

  const renderWord = (w: string, key: string | number): ReactNode => (
    <div key={key} className="inline-flex items-end shrink-0" style={{ gap: m.cellGap }}>
      {[...w].map((ch, ci) => {
        if (!CRYPTOGRAM_ALPHABET.includes(ch)) {
          return (
            <span key={ci} className="font-black text-center" style={{ color: 'var(--color-text)', width: m.punctWidth, fontSize: Math.round(cell * 0.5), paddingBottom: m.codeGap + m.codeChip }}>
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
        const look = cipherCellLook({ plain, locked, hinted, given: locked && state.given.includes(plain), finished, correct });
        const motion = motions.get(ch);
        const flip = motion?.kind === 'lock' && look !== 'typed' && look !== 'empty';
        const tileCls = [
          'gtile pz-cell',
          flip ? 'gt-flip' : '',
          motion?.kind === 'hint' ? 'gt-pop gt-hint' : look === 'typed' ? 'gt-pop' : '',
        ].filter(Boolean).join(' ');
        return (
          <button
            key={`${ci}-${motion?.seq ?? 0}`}
            type="button"
            onClick={() => onSelect(ch)}
            aria-label={`Code letter ${ch}${plain ? `, penciled ${plain}` : ''}${locked ? ', locked' : ''}`}
            className={`flex flex-col items-center ${wrong ? 'animate-shake' : ''}`}
            style={{ gap: m.codeGap }}
          >
            <span
              className={tileCls}
              data-s={look}
              data-sel={isSel ? 'true' : undefined}
              data-wrong={conflict || wrong ? 'true' : undefined}
              style={{
                width: cell,
                ['--gt-font' as string]: `${plainFont}px`,
                ['--pz-ring' as string]: CRYPTOGRAM_ACCENT,
                ['--pz-glow' as string]: alphaHex(CRYPTOGRAM_ACCENT, 0.35),
                ...(flip ? { ['--gt-d' as string]: `${motion.delay}ms` } : null),
              } as CSSProperties}
            >
              <b>{plain}</b>
              {motion?.kind === 'hint' && <span className="gt-glow-hint" aria-hidden="true" />}
              {flip && <span className="gt-cover" aria-hidden="true"><b>{plain}</b></span>}
            </span>
            <span
              className={`font-extrabold leading-none rounded-full ${isSel ? '' : CODE_INK.className}`}
              style={{
                fontSize: m.codeFont,
                fontFamily: MONO,
                padding: '2px 4px',
                ...(isSel
                  ? { ...glossyChip(CRYPTOGRAM_ACCENT, { lip: 0 }), border: `1px solid ${darken(CRYPTOGRAM_ACCENT, 0.2)}` }
                  : { ...CODE_INK.style, background: softBackground(CRYPTOGRAM_ACCENT, 0.14), border: softBorder(CRYPTOGRAM_ACCENT, 0.14, 1) }),
              }}
            >
              {ch}
            </span>
          </button>
        );
      })}
    </div>
  );

  const trayState = state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'playing';
  if (width == null) {
    return (
      <GameTray accent={CRYPTOGRAM_ACCENT} state={trayState} padding={CIPHER_TRAY_PAD} className="max-w-full">
        <div className="flex flex-wrap justify-center px-1 select-none" role="group" aria-label="Coded saying" style={{ columnGap: m.wordGap, rowGap: m.rowGap }}>
          {state.cipher.split(' ').map((w, wi) => renderWord(w, wi))}
        </div>
      </GameTray>
    );
  }

  const lines = wrapCipherWords(state.cipher, cell, width);
  return (
    <GameTray accent={CRYPTOGRAM_ACCENT} state={trayState} padding={CIPHER_TRAY_PAD} className="max-w-full">
      <div className="flex flex-col items-center select-none" role="group" aria-label="Coded saying" style={{ gap: m.rowGap }}>
        {lines.map((line, li) => (
          <div key={li} className="flex justify-center" style={{ gap: m.wordGap }}>
            {line.map((w, wi) => renderWord(w, `${li}-${wi}`))}
          </div>
        ))}
      </div>
    </GameTray>
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
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${locked ? CODE_INK.className : ''}`}
            style={{
              // A1: tinted chips (no plain white); the selected code letter takes a stronger wash + an accent rim.
              fontSize: chipFont,
              background: softBackground(CRYPTOGRAM_ACCENT, isSel ? 0.24 : 0.1),
              border: isSel ? `1.5px solid ${CRYPTOGRAM_ACCENT}` : softBorder(CRYPTOGRAM_ACCENT, 0.1, 1),
              color: locked ? undefined : 'var(--color-text-muted)',
              ...(locked ? CODE_INK.style : null),
            }}
            aria-label={`Code letter ${c}, ${freq[c]} times${plain ? `, penciled ${plain}` : ''}`}>
            <span style={{ fontFamily: MONO }}>{c}</span>
            <span className="opacity-70">{freq[c]}</span>
            {/* Founder 10-08: the "→X" slot is reserved from the start (a hidden "→W", the widest), so a letter
                landing never widens the chip, never re-wraps the strip and never shrinks the board above it. */}
            <span className="relative inline-grid font-black">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1">→W</span>
              {plain && <span className={`col-start-1 row-start-1 ${locked ? CODE_INK.className : ''}`} style={locked ? CODE_INK.style : { color: 'var(--color-text)' }}>→{plain}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
});
