import { generateShareImage, type ShareImageInput, type ShareMode } from './share-image';
import { openSharePreview } from '@/components/share/share-preview-modal';
import { supabase } from './supabase-client';
import { getTodayLocal } from './daily-service';

const SHARE_BUCKET = 'share-images';

type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

const EMOJI_MAP: Record<TileStateString, string> = {
  CORRECT: '\u{1F7EA}', // purple square
  PRESENT: '\u{1F7E7}', // orange square
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
 * Caption text attached to the image share. Deliberately just the site
 * URL — the image itself already shows the mode, stats, date, and
 * Win/Loss pill, so duplicating that information in the text body just
 * produced a second message bubble on top of the image in iMessage,
 * Messenger, etc. Leaving a bare URL lets the recipient's client
 * auto-expand it into a clean link-preview card without adding any
 * noise of its own. Also serves as the text-only fallback when neither
 * Web Share nor clipboard-image writes are available — the recipient
 * still gets a tappable route back to Wordocious.
 */
export function buildShareCaption(): string {
  return 'https://wordocious.com';
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

// ──────────────────────────────────────────────────────────────────────
// Per-result share URL (so Facebook / X / etc. show the puzzle image)
// ──────────────────────────────────────────────────────────────────────

/**
 * Upload the freshly-generated PNG to the public `share-images` bucket and
 * return a per-result page URL (https://wordocious.com/s/<uid>/<mode>-<date>)
 * carrying the result stats in its query string. That page (app/s/[...key])
 * emits Open Graph / Twitter-card tags whose `og:image` IS this exact PNG —
 * which is the only way social platforms (Facebook, X, LinkedIn, Reddit) can
 * render the finished puzzle, since they refuse pre-attached image files and
 * only scrape the shared URL.
 *
 * Returns null on any failure (not signed in, upload error) so the caller
 * falls back to the bare site URL — the directly-attached image still works
 * for Messages / WhatsApp / Mail regardless.
 */
async function uploadAndBuildShareUrl(blob: Blob, input: ShareImageInput): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const date = input.date ?? new Date(getTodayLocal() + 'T00:00:00');
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // One object per (user, mode, day): re-sharing the same result overwrites
    // identical bytes rather than accumulating, while the date keeps distinct
    // days on distinct URLs so social scrapers never serve a stale image.
    // The all-dailies card is keyed by a synthetic mode so it never collides
    // with a single-mode share on the same day.
    const keyMode = input.layout === 'daily-sweep' ? 'DailySweep' : input.mode;
    const key = `${user.id}/${keyMode}-${dateStr}`;
    const path = `${key}.png`;

    const { error } = await supabase.storage
      .from(SHARE_BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/png' });
    if (error) return null;

    const params = new URLSearchParams();
    if (input.layout === 'daily-sweep') {
      params.set('m', 'DailySweep');
      params.set('sweep', input.flawless ? 'flawless' : 'sweep');
      params.set('won', String(input.won));
      params.set('tot', String(input.total));
      params.set('t', String(input.totalTimeSeconds));
      params.set('pts', String(input.totalScore));
      params.set('w', '1080');
      params.set('h', '1350');
      params.set('v', `${input.flawless ? 'f' : 's'}${input.won}-${input.totalTimeSeconds}-${input.totalScore}`);
      return `https://wordocious.com/s/${key}?${params.toString()}`;
    }

    const isVertical = input.mode === 'OctoWord' || input.mode === 'Gauntlet';
    params.set('m', input.mode);
    params.set('won', input.won ? '1' : '0');
    params.set('g', String(input.guesses));
    params.set('mg', String(input.maxGuesses));
    params.set('t', String(input.timeSeconds));
    params.set('w', '1080');
    params.set('h', isVertical ? '1350' : '1080');
    if (input.layout === 'multi') {
      params.set('bs', String(input.boardsSolved));
      params.set('tb', String(input.totalBoards));
    } else if (input.layout === 'gauntlet') {
      params.set('sc', String(input.stagesCompleted));
      params.set('ts', String(input.totalStages));
    }
    // Distinguishes distinct results on the same URL so a social re-scrape
    // never serves a cached preview from an earlier attempt that day.
    params.set('v', `${input.won ? 'w' : 'x'}${input.guesses}-${input.timeSeconds}`);

    return `https://wordocious.com/s/${key}?${params.toString()}`;
  } catch {
    return null;
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
 * The caption is a per-result page URL (with the PNG uploaded behind it) so
 * that targets which ignore the attached file — Facebook, X, LinkedIn — still
 * render the puzzle via Open Graph. Falls back to the bare site URL.
 *
 * Returns which path succeeded so the caller can flash the right toast.
 */
export async function shareResult(
  input: ShareImageInput,
): Promise<ShareResultOutcome> {
  let blob: Blob | null = null;
  try {
    blob = await generateShareImage(input);
  } catch {
    blob = null;
  }

  // Prefer a per-result URL (puzzle PNG uploaded behind it); fall back to the
  // bare site URL if the upload can't happen.
  let caption = buildShareCaption();
  if (blob) {
    const url = await uploadAndBuildShareUrl(blob, input);
    if (url) caption = url;
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
