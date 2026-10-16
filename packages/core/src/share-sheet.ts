// ============================================================
// Share sheet: the shared model behind the custom share sheet (docs/review/share-sheet-plan.md §3,
// founder direction A, docs/design/review/share-sheet-1016/SPEC.md)
// ============================================================
// One pure function turns a share CONTEXT (where the user tapped Share, which cards that surface can render, whether
// the game has a spoiler-free variant, the current season) plus the PLATFORM into everything the sheet shows, top to
// bottom: the ordered card carousel, the "No spoilers | Full results" toggle and its copy, the look swatches (season +
// normal, only inside a season), and the ordered CHANNELS row with, per channel, what travels (image / text / link),
// the tracked `/go/<slug>` link and the caption. The PEOPLE row is the platform's own data (friends + system picker)
// and stays out of this model. No I/O; ported 1:1 to Swift / Kotlin and pinned by share-sheet-fixtures.json.
//
// Rules encoded here (plan §2 channel table + §S1):
//   * A result share to a messaging app is the IMAGE, no link, no caption (Messages / WhatsApp / More on iOS and
//     Android) so the chat shows the picture, not a link-preview card.
//   * Copy link and the text-only web intents (X, Facebook sharer, wa.me, sms:) carry `/go/<slug>`; Android X carries
//     image + text because its composer keeps both.
//   * Channels that need an app registration we don't have yet (Instagram/Facebook Stories = Meta App ID, Snapchat =
//     Snap Kit, TikTok = Share Kit) come back as `needsRegistration` and are NOT in `channels`; they wait in
//     `hiddenChannels` so the day the key exists the tile just moves over.

import { shareCaption, type ShareCaptionKind } from './share-captions';
import { shareVariantCopy, type ShareVariant, type ShareVariantCopy } from './share-spoilers';
import type { ShareFrame } from './share-hero';

export type ShareSurface = 'finished' | 'leaderboard' | 'sweep' | 'vs' | 'profile' | 'moment';
export type SharePlay = 'daily' | 'unlimited';
export type SharePlatform = 'ios' | 'android' | 'web';
export type ShareCardKind = 'result' | 'vs-result' | 'daily-sweep' | 'leaderboard' | 'moment' | 'profile' | 'streak' | 'achievement';
export type ShareChannelId = 'copy' | 'messages' | 'whatsapp' | 'stories' | 'x' | 'facebook' | 'snapchat' | 'tiktok' | 'save' | 'more';
export type ShareChannelAvailability = 'ready' | 'needsRegistration';
/** What the channel carries: the PNG alone, PNG + caption text, caption text + link, or just the link. */
export type ShareChannelPayload = 'image' | 'imageText' | 'text' | 'link';
export type ShareLookId = string; // a season id ('halloween', 'thanksgiving', …) or 'normal'

/** The caption pick for this share (share-captions.ts); null when the surface has no line (profile / moment). */
export interface ShareSheetCaption {
  kind: ShareCaptionKind;
  /** The result's day, YYYY-MM-DD (part of the pick key). */
  date: string;
  /** The game's display name (part of the pick key). */
  game: string;
  n?: string;
  t?: string;
  b?: string;
  d?: number;
  k?: string;
  opp?: string;
}

export interface ShareSheetContext {
  surface: ShareSurface;
  /** Catalog mode id for a finished game ('regions', 'quordle', …); '' elsewhere. Picks the toggle copy + rides the link. */
  mode: string;
  /** Daily or unlimited for a finished game; null elsewhere. */
  play: SharePlay | null;
  /** The card kinds this surface can render for this share (any order; the model orders them). */
  cards: ShareCardKind[];
  /** Does the result card have a spoiler-free variant (share-spoilers.ts models the puzzle games; word games too)? */
  hasSpoilerVariant: boolean;
  /** The current (ready) season id, or null outside a season. */
  season: string | null;
  caption: ShareSheetCaption | null;
}

export interface ShareSheetCard {
  kind: ShareCardKind;
  /** Carousel previews render the message frame; Stories re-render in `story` at tap time (channelFrame). */
  frame: ShareFrame;
  /** The label under the preview. */
  title: string;
}

export interface ShareSheetVariantToggle {
  shown: boolean;
  /** The sheet opens on this side (clean first: no spoilers by default). */
  initial: ShareVariant;
  copy: ShareVariantCopy;
}

export interface ShareSheetLook {
  id: ShareLookId;
  label: string;
}

export interface ShareSheetLooks {
  shown: boolean;
  /** The season first, then 'normal'; just ['normal'] outside a season. */
  options: ShareSheetLook[];
  initial: ShareLookId;
}

export interface ShareSheetChannel {
  id: ShareChannelId;
  label: string;
  availability: ShareChannelAvailability;
  payload: ShareChannelPayload;
  /** The `/go/<slug>` link this channel carries; null for image-only channels (§S1) and channels without a slug. */
  link: string | null;
  /** The share-captions line for text channels; null when the channel carries no text or the context has no caption. */
  caption: string | null;
  /** `caption + ' ' + link`, or whichever exists, for APIs that take one body (sms:, wa.me, EXTRA_TEXT); null for image-only. */
  text: string | null;
  /** Web only: the tile exists on phones (sms:, wa.me) and hides on desktop. */
  mobileOnly: boolean;
}

export interface ShareSheetModel {
  cards: ShareSheetCard[];
  variant: ShareSheetVariantToggle;
  looks: ShareSheetLooks;
  /** The ordered tiles to render (availability 'ready'). */
  channels: ShareSheetChannel[];
  /** Ordered tiles this platform could show once their registration exists (Stories, Snapchat, TikTok). */
  hiddenChannels: ShareSheetChannel[];
}

// ── Cards ─────────────────────────────────────────────────────────────────

/** Carousel order across every surface: the headline card first, then the extras. */
export const SHARE_CARD_ORDER: readonly ShareCardKind[] = ['result', 'vs-result', 'daily-sweep', 'leaderboard', 'moment', 'profile', 'streak', 'achievement'];

export const SHARE_CARD_TITLES: Readonly<Record<ShareCardKind, string>> = {
  result: 'Result',
  'vs-result': 'Race result',
  'daily-sweep': 'Daily sweep',
  leaderboard: 'Leaderboard',
  moment: 'Moment',
  profile: 'Profile',
  streak: 'Streak',
  achievement: 'Achievement',
};

/** The card a surface always has, used when the context lists none. */
export const SHARE_SURFACE_DEFAULT_CARD: Readonly<Record<ShareSurface, ShareCardKind>> = {
  finished: 'result',
  leaderboard: 'leaderboard',
  sweep: 'daily-sweep',
  vs: 'vs-result',
  profile: 'profile',
  moment: 'moment',
};

export function shareSheetCards(surface: ShareSurface, available: readonly ShareCardKind[]): ShareSheetCard[] {
  const want = available.length > 0 ? available : [SHARE_SURFACE_DEFAULT_CARD[surface]];
  return SHARE_CARD_ORDER.filter((k) => want.includes(k)).map((kind) => ({ kind, frame: 'message' as ShareFrame, title: SHARE_CARD_TITLES[kind] }));
}

// ── Looks ─────────────────────────────────────────────────────────────────

export const SHARE_LOOK_LABELS: Readonly<Record<string, string>> = {
  normal: 'Normal',
  halloween: 'Halloween',
  thanksgiving: 'Thanksgiving',
};

export function shareLookLabel(id: ShareLookId): string {
  const known = SHARE_LOOK_LABELS[id];
  if (known) return known;
  return id.length > 0 ? id[0].toUpperCase() + id.slice(1) : '';
}

export function shareSheetLooks(season: string | null): ShareSheetLooks {
  if (season == null || season === '' || season === 'normal') return { shown: false, options: [{ id: 'normal', label: 'Normal' }], initial: 'normal' };
  return { shown: true, options: [{ id: season, label: shareLookLabel(season) }, { id: 'normal', label: 'Normal' }], initial: season };
}

// ── Channels ──────────────────────────────────────────────────────────────

/** The CHANNELS row, left to right (direction A, plus Save image and TikTok). */
export const SHARE_CHANNEL_ORDER: readonly ShareChannelId[] = ['copy', 'messages', 'whatsapp', 'stories', 'x', 'facebook', 'snapchat', 'tiktok', 'save', 'more'];

export const SHARE_CHANNEL_LABELS: Readonly<Record<ShareChannelId, string>> = {
  copy: 'Copy link',
  messages: 'Messages',
  whatsapp: 'WhatsApp',
  stories: 'Stories',
  x: 'X',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
  save: 'Save image',
  more: 'More',
};

/** marketing_links slugs (docs/sql/20261016-share-sheet-slugs.sql adds copy / msg / wa / snapchat); null = no tracked link. */
export const SHARE_CHANNEL_SLUGS: Readonly<Record<ShareChannelId, string | null>> = {
  copy: 'copy',
  messages: 'msg',
  whatsapp: 'wa',
  stories: 'instagram',
  x: 'x',
  facebook: 'facebook',
  snapchat: 'snapchat',
  tiktok: 'tiktok',
  save: null,
  more: null,
};

export const SHARE_CHANNEL_AVAILABILITY: Readonly<Record<ShareChannelId, ShareChannelAvailability>> = {
  copy: 'ready',
  messages: 'ready',
  whatsapp: 'ready',
  stories: 'needsRegistration',
  x: 'ready',
  facebook: 'ready',
  snapchat: 'needsRegistration',
  tiktok: 'needsRegistration',
  save: 'ready',
  more: 'ready',
};

/** Plan §2, encoded: what each channel carries on each platform; null = the channel does not exist there. */
export const SHARE_CHANNEL_PAYLOADS: Readonly<Record<ShareChannelId, Readonly<Record<SharePlatform, ShareChannelPayload | null>>>> = {
  copy: { ios: 'link', android: 'link', web: 'link' },
  messages: { ios: 'image', android: 'image', web: 'text' },
  whatsapp: { ios: 'image', android: 'image', web: 'text' },
  stories: { ios: 'image', android: 'image', web: null },
  x: { ios: 'image', android: 'imageText', web: 'text' },
  facebook: { ios: 'image', android: 'image', web: 'link' },
  snapchat: { ios: 'image', android: 'image', web: 'link' },
  tiktok: { ios: 'image', android: 'image', web: null },
  save: { ios: 'image', android: 'image', web: 'image' },
  more: { ios: 'image', android: 'image', web: 'image' },
};

/** Web tiles that only make sense on a phone (sms: / wa.me). */
export const SHARE_CHANNEL_WEB_MOBILE_ONLY: readonly ShareChannelId[] = ['messages', 'whatsapp'];

export const SHARE_LINK_BASE = 'https://wordocious.com/go/';

/** The tracked link: `/go/<slug>?s=<surface>[&m=<mode>]`; the route counts the slug, the query rides along for logs. */
export function shareChannelLink(channel: ShareChannelId, surface: ShareSurface, mode: string): string | null {
  const slug = SHARE_CHANNEL_SLUGS[channel];
  if (slug == null) return null;
  const query = mode.length > 0 ? `?s=${surface}&m=${mode}` : `?s=${surface}`;
  return `${SHARE_LINK_BASE}${slug}${query}`;
}

/** Stories / Snapchat / TikTok want the 9:16 story frame; everything else the message frame. */
export function channelFrame(channel: ShareChannelId): ShareFrame {
  return channel === 'stories' || channel === 'snapchat' || channel === 'tiktok' ? 'story' : 'message';
}

export function channelCarriesImage(channel: ShareChannelId, platform: SharePlatform): boolean {
  const p = SHARE_CHANNEL_PAYLOADS[channel][platform];
  return p === 'image' || p === 'imageText';
}

export function channelCarriesLink(channel: ShareChannelId, platform: SharePlatform): boolean {
  const p = SHARE_CHANNEL_PAYLOADS[channel][platform];
  return p === 'link' || p === 'text' || p === 'imageText';
}

export function shareSheetChannel(channel: ShareChannelId, platform: SharePlatform, ctx: ShareSheetContext): ShareSheetChannel | null {
  const payload = SHARE_CHANNEL_PAYLOADS[channel][platform];
  if (payload == null) return null;
  const link = channelCarriesLink(channel, platform) ? shareChannelLink(channel, ctx.surface, ctx.mode) : null;
  const wantsText = payload === 'text' || payload === 'imageText';
  const caption = wantsText && ctx.caption
    ? shareCaption(ctx.caption.kind, { date: ctx.caption.date, game: ctx.caption.game, n: ctx.caption.n, t: ctx.caption.t, b: ctx.caption.b, d: ctx.caption.d, k: ctx.caption.k, opp: ctx.caption.opp })
    : null;
  const text = caption != null && link != null ? `${caption} ${link}` : wantsText ? (caption ?? link) : null;
  return {
    id: channel,
    label: SHARE_CHANNEL_LABELS[channel],
    availability: SHARE_CHANNEL_AVAILABILITY[channel],
    payload,
    link,
    caption,
    text,
    mobileOnly: platform === 'web' && SHARE_CHANNEL_WEB_MOBILE_ONLY.includes(channel),
  };
}

// ── The model ─────────────────────────────────────────────────────────────

export function shareSheetModel(ctx: ShareSheetContext, platform: SharePlatform): ShareSheetModel {
  const cards = shareSheetCards(ctx.surface, ctx.cards);
  const variant: ShareSheetVariantToggle = { shown: ctx.hasSpoilerVariant && cards.some((c) => c.kind === 'result'), initial: 'clean', copy: shareVariantCopy(ctx.mode) };
  const looks = shareSheetLooks(ctx.season);
  const channels: ShareSheetChannel[] = [], hiddenChannels: ShareSheetChannel[] = [];
  for (const id of SHARE_CHANNEL_ORDER) {
    const ch = shareSheetChannel(id, platform, ctx);
    if (ch) (ch.availability === 'ready' ? channels : hiddenChannels).push(ch);
  }
  return { cards, variant, looks, channels, hiddenChannels };
}
