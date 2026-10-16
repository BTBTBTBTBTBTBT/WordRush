// ============================================================
// Custom share sheet (direction A), web wiring. The model (what the sheet shows, in what order, what each channel
// carries) is core's shareSheetModel(ctx, 'web'); this file turns a channel tap into the web mechanism of plan §2
// (docs/review/share-sheet-plan.md): clipboard, sms:, wa.me, x.com/intent/post, facebook sharer, download, or
// navigator.share({ files }). Pure functions, no DOM except where a function says so, so the wiring is unit-tested.
// ============================================================

import type { ShareCardKind, ShareChannelId, ShareSheetChannel, ShareSheetContext } from '@wordle-duel/core';
import type { Season } from '@/lib/season';
import type { ShareVariant } from '@/components/share/share-variant-modal';

/** The feature switch (admin > Ops > Feature flags). Testers/admins only until the founder approves. */
export const SHARE_SHEET_FLAG = 'share_sheet_v2';

/** Renders one card of the carousel: the card kind, the spoiler variant and the look ('normal' or a season id). */
export type ShareSheetRender = (card: ShareCardKind, variant: ShareVariant, look: string) => Promise<Blob | null>;

export interface ShareSheetRequest {
  ctx: ShareSheetContext;
  render: ShareSheetRender;
  /** The game's display name; names the PNG ("Wordocious-QuadWord.png") and logs as share_events.game_mode. */
  fileMode: string;
}

/** The cache key of one rendered preview. */
export function sheetBlobKey(card: ShareCardKind, variant: ShareVariant, look: string): string {
  return `${card}|${variant}|${look}`;
}

/** A look id as the renderers want it: null = the normal look, otherwise the season id. */
export function lookToSeason(look: string): Season | null {
  return look === 'normal' || look === '' ? null : (look as Season);
}

/** sms: and wa.me only mean something on a phone. */
export function isMobileWeb(ua: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS reports a Mac user agent with touch points.
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

/** What a channel tap does, decided from the model's channel alone (no DOM). */
export type ChannelIntent =
  | { kind: 'copy'; text: string }
  | { kind: 'sms'; url: string }
  | { kind: 'open'; url: string }
  | { kind: 'save' }
  | { kind: 'more' }
  | { kind: 'none' };

export function xIntentUrl(ch: ShareSheetChannel): string {
  const q: string[] = [];
  if (ch.caption) q.push(`text=${encodeURIComponent(ch.caption)}`);
  if (ch.link) q.push(`url=${encodeURIComponent(ch.link)}`);
  return `https://x.com/intent/post${q.length > 0 ? `?${q.join('&')}` : ''}`;
}

export function channelIntent(ch: ShareSheetChannel): ChannelIntent {
  const text = ch.text ?? ch.link ?? '';
  switch (ch.id as ShareChannelId) {
    case 'copy':
      return ch.link ? { kind: 'copy', text: ch.link } : { kind: 'none' };
    case 'messages':
      // `sms:?&body=` is the form both iOS and Android's default SMS app accept.
      return text ? { kind: 'sms', url: `sms:?&body=${encodeURIComponent(text)}` } : { kind: 'none' };
    case 'whatsapp':
      return text ? { kind: 'open', url: `https://wa.me/?text=${encodeURIComponent(text)}` } : { kind: 'none' };
    case 'x':
      return ch.link || ch.caption ? { kind: 'open', url: xIntentUrl(ch) } : { kind: 'none' };
    case 'facebook':
      return ch.link ? { kind: 'open', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ch.link)}` } : { kind: 'none' };
    case 'save':
      return { kind: 'save' };
    case 'more':
      return { kind: 'more' };
    default:
      return { kind: 'none' };
  }
}

/** The channels this device shows: the model's ready tiles, minus the phone-only ones on a desktop. */
export function visibleChannels(channels: readonly ShareSheetChannel[], mobile: boolean): ShareSheetChannel[] {
  return channels.filter((c) => !c.mobileOnly || mobile);
}

/** share_events kind for a channel tap. */
export function channelEventKind(ch: ShareSheetChannel): 'image' | 'text' | 'other' {
  if (ch.payload === 'image' || ch.payload === 'imageText') return 'image';
  return ch.id === 'copy' ? 'other' : 'text';
}

/** The share_events surface for a channel tap ("post_game:facebook", within the 32-char column). */
export function channelEventSurface(channel: ShareChannelId): string {
  return `post_game:${channel}`.slice(0, 32);
}

/** The finished-game context: the one result card, the spoiler variant, today's season, the win / lose caption. */
export interface FinishedSheetArgs {
  /** The catalog mode id ('quordle', 'octordle', 'rescue', 'sequence', 'propernoundle', 'classic', 'six', 'seven'). */
  catalogMode: string;
  /** The game's display name ("QuadWord"). */
  gameName: string;
  isDaily: boolean;
  won: boolean;
  /** More than one board: a win reads "all {b} boards cleared". */
  multi: boolean;
  guesses: number;
  time: string;
  boardsTotal?: number;
  /** The result's day, YYYY-MM-DD. */
  date: string;
  /** The season id, or null outside one. */
  season: string | null;
  hasSpoilerVariant?: boolean;
}

export function finishedSheetContext(a: FinishedSheetArgs): ShareSheetContext {
  return {
    surface: 'finished',
    mode: a.catalogMode,
    play: a.isDaily ? 'daily' : 'unlimited',
    cards: ['result'],
    hasSpoilerVariant: a.hasSpoilerVariant ?? true,
    season: a.season,
    caption: {
      kind: a.won ? (a.multi ? 'multiWin' : 'win') : 'lose',
      date: a.date,
      game: a.gameName,
      n: String(a.guesses),
      t: a.time,
      b: a.boardsTotal != null ? String(a.boardsTotal) : undefined,
    },
  };
}
