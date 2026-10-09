'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  LIVE_EVENT_MOVE, LIVE_EVENT_REACT, LIVE_PING_TABLE, LIVE_REACT_COOLDOWN_MS, isLiveReaction, liveTopic,
  type LiveReaction,
} from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import type { GameView } from '@/lib/friendly-games-client';

/**
 * Live pocket games, web client (FRIDAY-QUEUE 9b; shared rules: core friendly-live.ts).
 * One Realtime channel per game: the server's broadcast carries the friend's move the instant
 * it is saved, postgres_changes on friendly_game_pings is the backup (it only says "refetch"),
 * presence tells us whether the friend is in the game and mid-move. `enabled` is
 * isLive('live_play'); off = this hook does nothing and the screen polls like before.
 */

export interface LivePeer { present: boolean; everSeen: boolean; thinking: boolean }

export interface LiveReactionEvent { id: number; from: string; reaction: LiveReaction }

interface Options {
  gameId: string;
  userId: string | null;
  opponentId: string | null;
  enabled: boolean;
  /** A view broadcast by the server for ME (already the receiver's view). */
  onView: (g: GameView) => void;
  /** The backup ping fired, or the socket just (re)connected: refetch through the API. */
  onRefetch: () => void;
  onReaction: (e: LiveReactionEvent) => void;
}

export function useLiveGame({ gameId, userId, opponentId, enabled, onView, onRefetch, onReaction }: Options) {
  const [socketUp, setSocketUp] = useState(false);
  const [peer, setPeer] = useState<LivePeer>({ present: false, everSeen: false, thinking: false });
  const chRef = useRef<RealtimeChannel | null>(null);
  const cbs = useRef({ onView, onRefetch, onReaction });
  cbs.current = { onView, onRefetch, onReaction };
  const lastReact = useRef(0);
  const reactSeq = useRef(0);
  const thinkingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || !opponentId) { setSocketUp(false); return; }
    let alive = true;
    let sub: RealtimeChannel;
    try {
      sub = supabase.channel(liveTopic(gameId), { config: { broadcast: { self: false }, presence: { key: userId } } });
    } catch {
      return;
    }
    chRef.current = sub;

    sub.on('broadcast', { event: LIVE_EVENT_MOVE }, ({ payload }) => {
      if (!alive || !payload || payload.by === userId || !payload.game) return;
      cbs.current.onView(payload.game as GameView);
    });
    sub.on('broadcast', { event: LIVE_EVENT_REACT }, ({ payload }) => {
      if (!alive || !payload || payload.from === userId || !isLiveReaction(payload.reaction)) return;
      cbs.current.onReaction({ id: ++reactSeq.current, from: String(payload.from), reaction: payload.reaction });
    });
    sub.on('postgres_changes', { event: '*', schema: 'public', table: LIVE_PING_TABLE, filter: `game_id=eq.${gameId}` }, (p) => {
      const by = (p.new as { updated_by?: string } | undefined)?.updated_by;
      if (alive && by !== userId) cbs.current.onRefetch();
    });
    sub.on('presence', { event: 'sync' }, () => {
      if (!alive) return;
      const state = sub.presenceState() as Record<string, Array<{ thinking?: boolean }>>;
      const metas = state[opponentId];
      const present = !!metas && metas.length > 0;
      setPeer((p) => ({ present, everSeen: p.everSeen || present, thinking: present && !!metas[metas.length - 1]?.thinking }));
    });

    sub.subscribe((status) => {
      if (!alive) return;
      if (status === 'SUBSCRIBED') {
        setSocketUp(true);
        void sub.track({ thinking: thinkingRef.current });
        cbs.current.onRefetch(); // catch up on anything missed while connecting
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setSocketUp(false);
      }
    });

    return () => {
      alive = false;
      setSocketUp(false);
      setPeer({ present: false, everSeen: false, thinking: false });
      chRef.current = null;
      void supabase.removeChannel(sub);
    };
  }, [enabled, gameId, userId, opponentId]);

  /** Presence meta: "I am mid-move" (a tile held, a word half typed). */
  const setThinking = useCallback((thinking: boolean) => {
    if (thinkingRef.current === thinking) return;
    thinkingRef.current = thinking;
    void chRef.current?.track({ thinking });
  }, []);

  /** Send a live reaction (throttled). Returns true if it went out. */
  const sendReaction = useCallback((reaction: LiveReaction): boolean => {
    const ch = chRef.current;
    const now = Date.now();
    if (!ch || !userId || now - lastReact.current < LIVE_REACT_COOLDOWN_MS) return false;
    lastReact.current = now;
    void ch.send({ type: 'broadcast', event: LIVE_EVENT_REACT, payload: { from: userId, reaction } });
    return true;
  }, [userId]);

  return { socketUp, peer, setThinking, sendReaction };
}
