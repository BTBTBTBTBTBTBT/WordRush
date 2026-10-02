'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateDailySeed, type VsDayResult, type WinLoss } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';
import { loadCpuProgression, emptyCpuProgression, botOfDayToday, type CpuProgression } from '@/lib/bot/cpu-progression';
import { botOfDayPersona } from '@/lib/bot/bot-personas';
import { readBotDaily, sumRecord, todaysBattle, utcCountdown, utcDay, type SentChallenge } from '@/lib/vs-lobby';
import {
  fetchDailyBattleOpponent, fetchDailyBattleRow, fetchVsChallenges, fetchVsStatRows, postRaceResult,
  type ChallengeView,
} from '@/lib/vs-challenges-client';
import { retryPendingRaces } from '@/lib/vs-pending-races';
import { recordGameResult } from '@/lib/stats-service';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

/**
 * Everything the VS lobby and banner read (VS overhaul §1–§2): the People and
 * Bots records (user_stats sums, exactly the Stats page's), today's Daily
 * Battle (the daily_results 'vs' row, else the local bot fallback), the Bot
 * of the Day and ladder from the progression store, and the challenges lists.
 * Each load first retries the race results waiting offline (§14).
 */
export function useVsLobbyData(userId: string | null) {
  const [people, setPeople] = useState<WinLoss>({ wins: 0, losses: 0 });
  const [bots, setBots] = useState<WinLoss>({ wins: 0, losses: 0 });
  const [battle, setBattle] = useState<{ result: VsDayResult; opponent: string | null }>({ result: 'open', opponent: null });
  // Filled after mount (localStorage), so the server render and hydration agree.
  const [progression, setProgression] = useState<CpuProgression>(emptyCpuProgression);
  const [incoming, setIncoming] = useState<ChallengeView[]>([]);
  const [sent, setSent] = useState<SentChallenge[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setProgression(loadCpuProgression());
    if (!userId) { setLoaded(true); return; }
    // §14: send any race result saved while offline before reading the
    // records, so an accepted one shows up in People right away.
    await retryPendingRaces({
      post: postRaceResult,
      record: (item, outcome) => recordGameResult(
        userId, item.gameMode, 'vs', outcome === 'win', item.run.guesses, item.run.timeMs, item.seed,
        undefined, undefined, 0, undefined, undefined, outcome === 'draw',
      ),
    }).catch(() => {});
    const day = utcDay();
    const [rows, row, challenges] = await Promise.all([
      fetchVsStatRows(userId),
      fetchDailyBattleRow(userId, getTodayLocal()),
      fetchVsChallenges(),
    ]);
    setPeople(sumRecord(rows, 'vs'));
    setBots(sumRecord(rows, 'vs_cpu'));
    setIncoming(challenges.incoming);
    setSent(challenges.sent);
    const opp = row && (row.vs_games ?? 0) > 0
      ? await fetchDailyBattleOpponent(userId, generateDailySeed(day, 'DUEL_VS'))
      : null;
    setBattle(todaysBattle(row, opp, readBotDaily(day)));
    setLoaded(true);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const day = utcDay();
  const botOfDay = { result: botOfDayToday(progression, day), bot: botOfDayPersona(day).name, botId: botOfDayPersona(day).id };
  return { people, bots, battle, botOfDay, progression, incoming, sent, loaded, refresh };
}

/** A ticking HH:MM:SS to the next UTC midnight. */
export function useUtcClock(): string {
  const [clock, setClock] = useState(() => utcCountdown());
  useEffect(() => {
    const t = setInterval(() => setClock(utcCountdown()), 1000);
    return () => clearInterval(t);
  }, []);
  return clock;
}

/** The matchmaking server's per-mode waiting counts, polled every 5 s (null until the first answer). */
export function useVsCounts(enabled = true): Record<string, number> | null {
  const [waiting, setWaiting] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/vs/counts`, { cache: 'no-store' });
        if (!res.ok) return;
        const obj = await res.json();
        if (!cancelled) setWaiting({ ...(obj.waiting ?? {}) });
      } catch { /* server offline: counts stay as they were */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [enabled]);
  return waiting;
}
