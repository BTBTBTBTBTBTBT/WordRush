import type { SupabaseClient } from '@supabase/supabase-js';
import {
  currentSeason, isFeatureLive, richAccent, richCollapseId, richThread,
  type RichPushFields, type SwitchRow,
} from '@wordle-duel/core';

// Rich push (FRIDAY-QUEUE item 34), server half: turns a friend/game event into the fields the
// iOS Notification Service / Content extensions, the Android MessagingStyle builder and the web
// service worker draw from. Images are server-rendered PNGs (iOS attachments can't be WebP):
//   GET /api/push/art/avatar/<userId>  the sender's mascot (or photo)
//   GET /api/push/art/game/<gameId>    the game's art
// Gated by the `rich_push` off-switch (and `season_halloween` for the orange accent).

export const PUSH_ORIGIN = 'https://wordocious.com';

/** What a caller knows about the event. */
export interface RichInput {
  senderId: string;
  senderName: string;
  /** A catalog game id (practice, hub, sudoku...) or a pocket game ('pocket-rps'). */
  gameId: string;
  gameTitle: string;
  /** The game's accent color (modes.generated accentHex). */
  accentHex?: string | null;
  /** The pocket game's row id: threads + collapses by game. */
  gameRowId?: string | null;
  score?: string;
  /** What this event is, for the collapse key (move / taunt / challenge...). */
  kind: string;
  /** The exact route a tap opens. */
  url: string;
}

export function avatarUrl(userId: string): string {
  return `${PUSH_ORIGIN}/api/push/art/avatar/${encodeURIComponent(userId)}`;
}

export function gameImageUrl(gameId: string): string {
  return `${PUSH_ORIGIN}/api/push/art/game/${encodeURIComponent(gameId)}`;
}

export function buildRichFields(input: RichInput, halloween: boolean): { fields: RichPushFields; collapseId?: string } {
  const thread = richThread({ senderId: input.senderId, gameRowId: input.gameRowId });
  return {
    fields: {
      senderId: input.senderId,
      senderName: input.senderName,
      senderAvatar: avatarUrl(input.senderId),
      gameId: input.gameId,
      gameTitle: input.gameTitle,
      gameImage: gameImageUrl(input.gameId),
      thread,
      accent: richAccent(input.accentHex, halloween),
      halloween: halloween ? '1' : '0',
      ...(input.score ? { score: input.score } : {}),
      url: input.url,
    },
    collapseId: richCollapseId({ gameRowId: input.gameRowId, senderId: input.senderId, kind: input.kind }),
  };
}

/** Reads the two switches (fail open like the clients: unreachable / no row = on). */
export async function richPushSwitches(sb: SupabaseClient): Promise<{ rich: boolean; halloween: boolean }> {
  let flags: Record<string, SwitchRow> | null = null;
  try {
    const { data, error } = await sb.from('app_flags').select('key, enabled, audience').in('key', ['rich_push', 'season_halloween']);
    if (!error && data) flags = Object.fromEntries((data as Array<{ key: string; enabled: boolean; audience: string }>).map((r) => [r.key, { enabled: r.enabled, audience: r.audience }]));
  } catch { /* fail open */ }
  const season = currentSeason(new Date()) != null;
  return {
    // A staged ('testers') re-enable doesn't apply to a push going to real players: only 'all' counts as live here.
    rich: isFeatureLive('rich_push', flags, false),
    halloween: season && isFeatureLive('season_halloween', flags, false),
  };
}
