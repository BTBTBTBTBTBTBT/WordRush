import { generateShareImage, type ShareImageInput, type ShareMode } from './share-image';
import { openSharePreview } from '@/components/share/share-preview-modal';

type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

const EMOJI_MAP: Record<TileStateString, string> = {
  CORRECT: '\u{1F7E9}', // green square
  PRESENT: '\u{1F7E8}', // yellow square
  ABSENT: '\u{2B1B}',   // black square
  EMPTY: '\u{2B1C}',    // white square
};

export function tileToEmoji(state: TileStateString): string {
  return EMOJI_MAP[state] || EMOJI_MAP.EMPTY;
}

/**
 * Generate emoji grid from a single board's evaluations.
 * Kept as a helper for the text-fallback caption only — the primary share
 * surface is now an image rendered by generateShareImage + shareResult.
 */
export function generateEmojiGrid(evaluations: TileStateString[][]): string {
  return evaluations
    .map(row => row.map(tile => tileToEmoji(tile)).join(''))
    .join('\n');
}

/**
 * Short caption text for the image share (prefilled into Web Share sheet
 * or written alongside the image on the clipboard). Also serves as the
 * final text-only fallback when neither Web Share nor clipboard-image
 * writes are available. Deliberately compact so it renders cleanly in
 * iMessage/Twitter link previews even before the image loads.
 */
export function buildShareCaption(opts: {
  mode: string;
  won: boolean;
  guesses: number;
  maxGuesses: number;
  timeSeconds: number;
  boardsSolved?: number;
  totalBoards?: number;
  stagesCompleted?: number;
  totalStages?: number;
  date?: Date;
}): string {
  const { mode, won, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, stagesCompleted, totalStages, date } = opts;
  const mins = Math.floor(timeSeconds / 60);
  const secs = timeSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const d = date ?? new Date();
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const outcome = won ? 'Win' : 'Loss';

  let statLine: string;
  if (typeof stagesCompleted === 'number' && typeof totalStages === 'number') {
    statLine = `${stagesCompleted}/${totalStages} stages in ${guesses} guesses · ${timeStr}`;
  } else if (typeof boardsSolved === 'number' && typeof totalBoards === 'number' && totalBoards > 1) {
    const g = won ? `${guesses}/${maxGuesses}` : `X/${maxGuesses}`;
    statLine = `${boardsSolved}/${totalBoards} boards · ${g} guesses · ${timeStr}`;
  } else {
    const g = won ? `${guesses}/${maxGuesses}` : `X/${maxGuesses}`;
    statLine = `${g} guesses · ${timeStr}`;
  }

  return `Wordocious ${mode} — ${outcome} · ${dateStr}\n${statLine}\n\nhttps://wordocious.com/daily`;
}

// ──────────────────────────────────────────────────────────────────────
// Progressive share flow (image first, then fallbacks)
// ──────────────────────────────────────────────────────────────────────

export interface ShareResultOutcome {
  /** 'share' = Web Share sheet opened; 'clipboard' = image + text on clipboard; 'modal' = preview modal shown; 'text' = text-only fallback copied; 'failed' = nothing worked. */
  via: 'share' | 'clipboard' | 'modal' | 'text' | 'failed';
}

async function tryWebShare(blob: Blob, caption: string, mode: ShareMode): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    const file = new File([blob], `wordocious-${Date.now()}.png`, { type: 'image/png' });
    // canShare with files fails entirely on browsers that don't support file sharing.
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({
      files: [file],
      text: caption,
      title: `Wordocious ${mode}`,
    });
    return true;
  } catch (err) {
    // AbortError (user canceled) still counts as a "handled" share from our POV
    // so we don't fall through to clipboard-copy something they already saw.
    if (err instanceof DOMException && err.name === 'AbortError') return true;
    return false;
  }
}

async function tryClipboardImage(blob: Blob, caption: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
        'text/plain': new Blob([caption], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Single entry point every game's Share button calls. Generates a PNG from
 * the supplied game-result payload and then walks progressive fallbacks:
 *
 *   1. Web Share (mobile native share sheet with the image attached).
 *   2. Clipboard image + text (iOS Safari 16.4+, desktop Chrome).
 *   3. Preview modal with Save/Copy buttons.
 *   4. Text-only clipboard copy of the caption (mirrors old behavior).
 *
 * Returns which path succeeded so the caller can flash the right toast.
 */
export async function shareResult(
  input: ShareImageInput,
): Promise<ShareResultOutcome> {
  const caption = buildShareCaption({
    mode: input.mode,
    won: input.won,
    guesses: input.guesses,
    maxGuesses: input.maxGuesses,
    timeSeconds: input.timeSeconds,
    boardsSolved: input.layout === 'multi' ? input.boardsSolved : undefined,
    totalBoards: input.layout === 'multi' ? input.totalBoards : undefined,
    stagesCompleted: input.layout === 'gauntlet' ? input.stagesCompleted : undefined,
    totalStages: input.layout === 'gauntlet' ? input.totalStages : undefined,
    date: input.date,
  });

  let blob: Blob | null = null;
  try {
    blob = await generateShareImage(input);
  } catch {
    blob = null;
  }

  if (blob) {
    if (await tryWebShare(blob, caption, input.mode)) return { via: 'share' };
    if (await tryClipboardImage(blob, caption)) return { via: 'clipboard' };
    // Preview modal as a visible fallback before giving up.
    try {
      openSharePreview(blob, caption);
      return { via: 'modal' };
    } catch {
      // fall through to text copy
    }
  }

  // Image generation failed OR modal path errored — at minimum copy the caption
  // so the user still has something to paste.
  const copied = await copyShareToClipboard(caption);
  return { via: copied ? 'text' : 'failed' };
}

/**
 * Copy text to clipboard with fallback.
 */
export async function copyShareToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
