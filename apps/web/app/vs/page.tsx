'use client';

/**
 * VS Battle lobby — entry point from the Home "VS Battle" card. Port of the
 * native iOS VSLobbyView (the native screen is the source of truth here):
 * teal header, QUICK MATCH mode list (all 9 VS-capable modes, with live
 * per-mode activity from the server's /vs/counts), and PRIVATE MATCH below —
 * join with a code + create-a-private-match mode grid. Free users get one
 * daily Classic VS + the Pro upsell; guests are prompted to sign in.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Crown, Swords, Check, Loader2 } from 'lucide-react';
import { GameMode } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { getTodayLocal } from '@/lib/daily-service';
import { createInvite, lookupInviteByCode, vsHrefForMode } from '@/lib/invite-service';
import { VsLimitModal } from '@/components/modals/vs-limit-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

/** All VS-capable modes, in the native lobby's order. Titles are the
 *  UPPERCASED share labels — exact native parity (iOS ModeStyle.title =
 *  shareLabel.uppercased(): CLASSIC SIX, QUADWORD, …). */
const MODES: Array<{ gm: string; title: string; gradient: string }> = [
  { gm: GameMode.DUEL, title: 'CLASSIC', gradient: 'from-cyan-500 via-blue-500 to-teal-500' },
  { gm: GameMode.DUEL_6, title: 'CLASSIC SIX', gradient: 'from-cyan-500 via-teal-500 to-sky-500' },
  { gm: GameMode.DUEL_7, title: 'CLASSIC SEVEN', gradient: 'from-lime-500 via-green-500 to-emerald-500' },
  { gm: GameMode.QUORDLE, title: 'QUADWORD', gradient: 'from-yellow-500 via-pink-500 to-purple-500' },
  { gm: GameMode.OCTORDLE, title: 'OCTOWORD', gradient: 'from-cyan-500 via-purple-500 to-pink-500' },
  { gm: GameMode.SEQUENCE, title: 'SUCCESSION', gradient: 'from-yellow-500 via-orange-500 to-red-500' },
  { gm: GameMode.RESCUE, title: 'DELIVERANCE', gradient: 'from-indigo-500 via-purple-500 to-fuchsia-500' },
  { gm: GameMode.GAUNTLET, title: 'GAUNTLET', gradient: 'from-amber-500 via-orange-500 to-red-500' },
  { gm: GameMode.PROPERNOUNDLE, title: 'PROPERNOUNDLE', gradient: 'from-red-500 via-rose-500 to-orange-500' },
];

interface VsCount { waiting: number; playing: number }

export default function VsLobbyPage() {
  const router = useRouter();
  const { profile, isProActive, isGuest, exitGuest } = useAuth();

  const [joinCode, setJoinCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [dailyVsUsed, setDailyVsUsed] = useState(false);
  const [showVsLimit, setShowVsLimit] = useState(false);
  const [counts, setCounts] = useState<Record<string, VsCount>>({});

  const isPro = isProActive;

  // Live per-mode activity — poll the matchmaking server's /vs/counts every
  // 5s while the lobby is on screen (native pollCounts parity).
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/vs/counts`);
        if (!res.ok) return;
        const obj = await res.json();
        if (cancelled) return;
        const keys = new Set([...Object.keys(obj.waiting ?? {}), ...Object.keys(obj.playing ?? {})]);
        const next: Record<string, VsCount> = {};
        keys.forEach((k) => { next[k] = { waiting: obj.waiting?.[k] ?? 0, playing: obj.playing?.[k] ?? 0 }; });
        setCounts(next);
      } catch { /* server offline — rows just show without counts */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Free tier: has the one daily Classic VS already been used today?
  // (native hasPlayedDailyVS parity — daily_results play_type='vs' row.)
  useEffect(() => {
    if (isPro || !profile?.id) return;
    (async () => {
      const { count } = await (supabase as any)
        .from('daily_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('day', getTodayLocal())
        .eq('game_mode', 'DUEL')
        .eq('play_type', 'vs');
      setDailyVsUsed((count ?? 0) > 0);
    })();
  }, [isPro, profile?.id]);

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setLookupError(null);
    setJoining(true);
    const invite = await lookupInviteByCode(code);
    setJoining(false);
    if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) {
      setLookupError('No match found for that code.');
      return;
    }
    router.push(`${vsHrefForMode(invite.game_mode)}?inviteCode=${invite.invite_code}`);
  }, [joinCode, router]);

  const handleCreate = useCallback(async (gm: string) => {
    if (!profile || creating) return;
    setLookupError(null);
    setCreating(gm);
    const { invite, error } = await createInvite({ inviterId: profile.id, gameMode: gm });
    setCreating(null);
    if (error || !invite) {
      setLookupError(error ?? "Couldn't create an invite. Try again.");
      return;
    }
    router.push(`${vsHrefForMode(gm)}?inviteCode=${invite.invite_code}`);
  }, [profile, creating, router]);

  const card = 'rounded-2xl border p-4';
  const cardStyle = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' } as const;

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />
      <VsLimitModal open={showVsLimit} onClose={() => setShowVsLimit(false)} />

      <div className="max-w-md mx-auto px-4 pt-2 space-y-3.5">
        {/* Header — teal swords + gradient title (native lobby header). */}
        <div className="text-center pt-2 pb-1">
          <Swords className="w-10 h-10 mx-auto" style={{ color: '#0d9488' }} />
          <h1 className="text-3xl font-black tracking-tight mt-1 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600">
            VS BATTLE
          </h1>
          <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Race a live opponent on the same puzzle
          </p>
        </div>

        {isGuest && !profile ? (
          /* VS is account-based (live opponents, recorded results). */
          <div className={card} style={cardStyle}>
            <div className="text-center space-y-3 py-2">
              <div className="text-base font-black" style={{ color: 'var(--color-text)' }}>Sign in to play VS</div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                VS Battle pits you against a live opponent and records your results — it needs an account.
              </p>
              <button
                onClick={exitGuest}
                className="w-full rounded-xl py-3 text-[15px] font-black text-white"
                style={{ background: '#7c3aed' }}
              >
                Sign in
              </button>
            </div>
          </div>
        ) : isPro ? (
          <>
            {/* QUICK MATCH — one row per VS-capable mode. */}
            <SectionLabel>Quick Match</SectionLabel>
            {MODES.map((m) => {
              const c = counts[m.gm];
              const active = c && c.waiting + c.playing > 0;
              return (
                <Link
                  key={m.gm}
                  href={vsHrefForMode(m.gm)}
                  className="flex items-center justify-between rounded-[14px] border px-4 py-4 transition-transform active:scale-[0.99]"
                  style={cardStyle}
                >
                  <div>
                    <div className={`text-base font-black text-transparent bg-clip-text bg-gradient-to-r ${m.gradient}`}>
                      {m.title}
                    </div>
                    {active && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                          {c.playing} playing · {c.waiting} waiting
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                </Link>
              );
            })}

            {/* PRIVATE MATCH — join by code + create an invite. */}
            <SectionLabel>Private Match</SectionLabel>
            <div className={card} style={cardStyle}>
              <div className="text-[13px] font-extrabold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Join with a code
              </div>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                  placeholder="CODE"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 rounded-[10px] border px-3 py-2.5 text-[15px] font-extrabold tracking-[2px] outline-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.trim().length < 4 || joining}
                  className="rounded-[10px] px-5 py-2.5 text-sm font-black text-white disabled:opacity-40"
                  style={{ background: '#7c3aed' }}
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                </button>
              </div>
              {lookupError && <p className="text-xs font-medium mt-2" style={{ color: '#dc2626' }}>{lookupError}</p>}
            </div>

            <div className={card} style={cardStyle}>
              <div className="text-[13px] font-extrabold" style={{ color: 'var(--color-text-secondary)' }}>
                Create a private match
              </div>
              <p className="text-xs font-medium mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Pick a mode — we&apos;ll generate a code to share. Your friend joins with it.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.gm}
                    onClick={() => handleCreate(m.gm)}
                    disabled={creating !== null}
                    className="flex items-center justify-center gap-1.5 rounded-[10px] border py-2.5 text-xs font-black disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                  >
                    {creating === m.gm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {m.title}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* FREE — one daily Classic VS + the Pro upsell (native freeContent). */}
            {dailyVsUsed ? (
              <button
                onClick={() => setShowVsLimit(true)}
                className="w-full rounded-2xl py-4 text-white"
                style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}
              >
                <div className="text-lg font-black">Play Daily VS</div>
                <div className="text-xs font-bold opacity-85">Used today · tap for details</div>
              </button>
            ) : (
              <Link
                href="/practice/vs?daily=true"
                className="block w-full rounded-2xl py-4 text-white text-center"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
              >
                <div className="text-lg font-black">Play Daily VS</div>
                <div className="text-xs font-bold opacity-85">One free Classic match a day</div>
              </Link>
            )}

            <div className={card} style={cardStyle}>
              <div className="text-xs font-extrabold tracking-wide text-center mb-2" style={{ color: 'var(--color-text-muted)' }}>
                UNLOCK WITH PRO
              </div>
              <div className="space-y-1.5 mb-3">
                {['All modes in VS — unlimited matches', 'Private matches: invite friends by code', 'Rematches'].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#d97706' }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/pro"
                className="flex items-center justify-center gap-1.5 w-full rounded-xl py-3 text-sm font-black text-white"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <Crown className="w-4 h-4" /> Go Pro
              </Link>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold tracking-[0.8px] uppercase pt-1" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </div>
  );
}
