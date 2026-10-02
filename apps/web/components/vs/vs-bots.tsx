'use client';

/**
 * The Bots page (VS overhaul §8): the Bot of the Day (same bot, same puzzle for
 * everyone, once per UTC day), THE LADDER (Rook → Lexi → Nova → Adapt, three
 * wins in a row clear a rung — core ladderRungs), and BEAT YOUR BEST (a ghost
 * of your best run). Every tap starts the game through the normal VS screen
 * (?cpu=<kind>). Free players get the Bot of the Day in Classic; the ladder and
 * the ghost are Pro.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { ladderRungs, vsClock, VS_MODE_ORDER } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { vsHrefForMode } from '@/lib/invite-service';
import { BOT_OF_DAY_ID, BOT_ROSTER, botArt } from '@/lib/bot/bot-personas';
import { botOfDayToday, emptyCpuProgression, loadCpuProgression, type CpuProgression } from '@/lib/bot/cpu-progression';
import { fetchBestGhostRun, type GhostRun } from '@/lib/bot/ghost-service';
import type { CpuKind } from '@/lib/adapters/bot-match-service';
import { VS, loadVsMode, modeTitle, todayTileLine, utcDay } from '@/lib/vs-lobby';
import { BottomNav } from '@/components/ui/bottom-nav';
import { BotAvatar, ModeChip, SectionLabel, SoftPill, TealButton, VsNav, vsCardStyle } from './vs-ui';
import { PAGE_HOSTS } from '@/lib/mascots';

const KIND_BY_BOT: Record<string, CpuKind> = { rook: 'easy', lexi: 'medium', nova: 'hard', adapt: 'adaptive' };

export function VsBots() {
  const router = useRouter();
  const { profile, isProActive, isGuest, exitGuest, loading } = useAuth();
  const isPro = isProActive;
  const [mode, setMode] = useState('DUEL');
  const [p, setP] = useState<CpuProgression>(emptyCpuProgression);
  const [ghost, setGhost] = useState<GhostRun | null>(null);

  useEffect(() => { setMode(loadVsMode(isPro, VS_MODE_ORDER)); setP(loadCpuProgression()); }, [isPro]);
  useEffect(() => {
    if (!isPro || !profile?.id) { setGhost(null); return; }
    fetchBestGhostRun(profile.id, mode).then(setGhost).catch(() => {});
  }, [isPro, profile?.id, mode]);

  const play = (kind: CpuKind) => router.push(`${vsHrefForMode(isPro ? mode : 'DUEL')}?cpu=${kind}`);
  const bod = BOT_ROSTER[BOT_OF_DAY_ID];
  const bodResult = botOfDayToday(p, utcDay());
  const rungs = ladderRungs({ cleared: p.ladderCleared, run: p.ladderRun });
  const nextIndex = rungs.findIndex((r) => r.state === 'next');

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: VS.page }}>
      <div className="max-w-md mx-auto px-4 pt-2 space-y-3.5">
        <VsNav title="BOTS" host={PAGE_HOSTS.vs} onBack={() => router.push('/vs')} right={<ModeChip mode={isPro ? mode : 'DUEL'} />} />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: VS.ink }} /></div>
        ) : isGuest && !profile ? (
          <div className="p-4 text-center space-y-3" style={vsCardStyle}>
            <div className="text-base font-black" style={{ color: VS.deep }}>Sign in to play the bots</div>
            <button onClick={exitGuest} className="w-full py-3 text-[15px] font-black text-white" style={{ background: VS.ink, borderRadius: 12 }}>SIGN IN</button>
          </div>
        ) : (
          <>
            {/* BOT OF THE DAY — the frosted teal window. */}
            <div className="overflow-hidden" style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #d5f5ee, #e0f2fe)', boxShadow: '0 4px 14px rgba(15,118,110,0.10)' }}>
              <div style={{ padding: '12px 12px 10px', background: 'rgba(255,255,255,0.5)' }}>
                <div className="font-black" style={{ fontSize: 16, color: VS.deep, letterSpacing: 0.4 }}>BOT OF THE DAY · {bod.name.toUpperCase()}</div>
                <div className="font-extrabold" style={{ fontSize: 10.5, color: VS.ink, letterSpacing: 0.4 }}>SAME BOT, SAME PUZZLE FOR EVERYONE</div>
              </div>
              <div className="flex items-center gap-3" style={{ padding: '12px' }}>
                <BotAvatar src={botArt(bod.id)} name={bod.name} size={48} bg="#ffffff" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-black" style={{ color: VS.deep }}>{bod.line}</div>
                  {p.botOfDayStreak > 0 && (
                    <div className="flex items-center gap-1 text-[11.5px] font-black" style={{ color: '#c2410c' }}>
                      <Icon3D name="flame" size={14} /> {p.botOfDayStreak} {p.botOfDayStreak === 1 ? 'day' : 'days'} in a row
                    </div>
                  )}
                </div>
                {bodResult === 'open' ? (
                  <TealButton className="px-5 py-2.5 text-[13px]" onClick={() => play('daily')}>Play</TealButton>
                ) : (
                  <span
                    className="px-3 py-1.5 text-[12px] font-black rounded-full"
                    style={{ background: bodResult === 'won' ? VS.ink : '#9ca3af', color: '#ffffff' }}
                  >
                    {todayTileLine(bodResult, bod.name, bod.name, false)}
                  </span>
                )}
              </div>
            </div>

            {/* THE LADDER */}
            <SectionLabel right={
              <span className="text-[11px] font-black" style={{ color: '#c2410c', letterSpacing: 0.6 }}>STREAK {p.streak} · BEST {p.bestStreak}</span>
            }>The ladder</SectionLabel>
            <div className="relative">
              {rungs.map((r, i) => {
                const bot = BOT_ROSTER[r.id];
                const locked = r.state === 'locked';
                const isNext = r.state === 'next';
                const canPlay = isPro && !locked;
                const ring = r.state === 'cleared' ? `0 0 0 2px ${VS.ink}` : isNext ? '0 0 0 2px #7c3aed, 0 0 10px rgba(124,58,237,0.45)' : undefined;
                const tag = r.state === 'cleared' ? { t: 'CLEARED', c: VS.ink } : isNext ? { t: 'NEXT', c: '#c2410c' } : { t: 'LOCKED', c: '#9ca3af' };
                return (
                  <div key={r.id} className="relative" style={{ paddingBottom: i < rungs.length - 1 ? 10 : 0 }}>
                    {/* The 3px line to the next rung: teal up to the next rung, gray after. */}
                    {i < rungs.length - 1 && (
                      <span className="absolute" style={{ left: 29, top: 40, bottom: -2, width: 3, borderRadius: 2, background: nextIndex >= 0 && i < nextIndex ? VS.ink : '#d1d5db' }} />
                    )}
                    <button
                      type="button"
                      onClick={() => (isPro ? (canPlay ? play(KIND_BY_BOT[r.id]) : undefined) : router.push('/pro'))}
                      className="relative w-full flex items-center gap-3 px-3 py-2.5 text-left"
                      style={{
                        borderRadius: 14,
                        background: isNext ? '#ffffff' : 'transparent',
                        boxShadow: isNext ? `0 0 0 2px ${VS.ink}, ${VS.cardShadow}` : undefined,
                        opacity: locked ? 0.55 : 1,
                        cursor: canPlay || !isPro ? 'pointer' : 'default',
                      }}
                    >
                      <BotAvatar src={botArt(r.id)} name={bot.name} size={36} bg={r.state === 'cleared' ? VS.soft : isNext ? '#ede9fe' : '#e5e7eb'} ring={ring} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-black" style={{ color: '#1f2937' }}>{bot.name} · {bot.tier}</span>
                        <span className="block text-[11px] font-bold truncate" style={{ color: '#4b5563' }}>{r.line}</span>
                      </span>
                      {isPro ? (
                        <span className="text-[10px] font-black" style={{ color: tag.c, letterSpacing: 0.8 }}>{tag.t}</span>
                      ) : (
                        <Icon3D name="lock" size={17} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* BEAT YOUR BEST */}
            {(!isPro || ghost) && (
              <div className="flex items-center gap-3 p-3" style={vsCardStyle}>
                <BotAvatar src={botArt('ghost')} name="Your Ghost" size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-black" style={{ color: '#1f2937' }}>Beat your best</span>
                  <span className="block text-[11px] font-bold truncate" style={{ color: '#4b5563' }}>
                    {ghost ? `Your best ${modeTitle(mode)}: ${ghost.guessCount} guesses · ${vsClock(ghost.timeMs)}` : 'Race a replay of your best run'}
                  </span>
                </span>
                {isPro ? (
                  <SoftPill onClick={() => play('ghost')}>Race it</SoftPill>
                ) : (
                  <button type="button" onClick={() => router.push('/pro')} aria-label="Pro" className="p-1"><Icon3D name="lock" size={17} /></button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
