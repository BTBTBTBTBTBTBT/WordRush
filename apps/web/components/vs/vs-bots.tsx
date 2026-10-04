'use client';

/**
 * The Bots page (VS overhaul §8; finishing build docs/FINISH_SPEC.md D1–D3):
 * the Bot of the Day (today's day-host character — same bot, same puzzle for
 * everyone, once per UTC day), THE LADDER of the ten cast bots (Rip → Webster,
 * three wins in a row clear a rung — core ladderRungs), and YOUR GHOST (your
 * best run, drawn as a faded version of your own letter tile). Every tap
 * starts the game through the normal VS screen (?cpu=<kind>). Free players get
 * the Bot of the Day in Classic; the ladder and the ghost are Pro.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton, candyClass } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { CastLoader } from '@/components/ui/cast-loader';
import { LADDER_BOTS, LADDER_CLEAR_RUN, ladderRungs, vsClock, VS_MODE_ORDER } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { vsHrefForMode } from '@/lib/invite-service';
import { botLine, botOfDayPersona, botPersona, botRosterEntry, type BotPose } from '@/lib/bot/bot-personas';
import { botOfDayToday, emptyCpuProgression, loadCpuProgression, type CpuProgression } from '@/lib/bot/cpu-progression';
import { fetchBestGhostRun, type GhostRun } from '@/lib/bot/ghost-service';
import type { CpuKind } from '@/lib/adapters/bot-match-service';
import { VS, loadVsMode, modeTitle, todayTileLine, utcDay } from '@/lib/vs-lobby';
import { darken } from '@/lib/soft-surface';
import { BottomNav } from '@/components/ui/bottom-nav';
import {
  BotFigure, BotPoseAvatar, BotSpeech, CardBar, GhostAvatar, ModeChip, SectionLabel, SoftPill, TealButton, VS_ACCENT, VS_LIGHT_VARS,
  VsCard, VsNav, vsCard,
} from './vs-ui';
import { PAGE_HOSTS } from '@/lib/mascots';
import { ArtScene } from '@/components/ui/art-scene';
import { medalSrc } from '@/lib/art';
import { PageBackground } from '@/components/ui/page-background';

/** The Bot of the Day card's pose for today's result (never the ladder's 'ready' image — A7). */
function botOfDayPose(result: ReturnType<typeof botOfDayToday>): BotPose {
  return result === 'lost' ? 'victory' : result === 'open' ? 'waiting' : 'goodgame';
}

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
  const day = utcDay();
  const bodPersona = botOfDayPersona(day);
  const bod = botRosterEntry(bodPersona.id);
  const bodResult = botOfDayToday(p, day);
  // One line per visit in the bot's own voice (kind, never mean); picked after
  // mount (the pick is random, so it never differs between server and client).
  const [bodLine, setBodLine] = useState<string | null>(null);
  useEffect(() => {
    setBodLine(botLine(bodPersona.id, bodResult === 'lost' ? 'bot_win' : bodResult === 'open' ? 'match_start' : 'bot_loss'));
  }, [bodPersona.id, bodResult]);
  const rungs = ladderRungs({ cleared: p.ladderCleared, run: p.ladderRun });
  const cleared = Math.min(p.ladderCleared, LADDER_BOTS.length);
  const me = profile as { username?: string | null; avatar_emoji?: string | null; accent_color?: string | null } | null;

  return (
    <PageBackground tint="vs" scheme="light" className="min-h-screen pb-24" style={VS_LIGHT_VARS}>
      {/* BJ7: 12 between sections. */}
      <div className="max-w-md mx-auto px-4 pt-2 space-y-3">
        <VsNav title="BOTS" heading="bots" host={PAGE_HOSTS.vs} onBack={() => router.push('/vs')} right={<ModeChip mode={isPro ? mode : 'DUEL'} />} />

        {loading ? (
          <div className="flex justify-center py-16"><CastLoader /></div>
        ) : isGuest && !profile ? (
          <VsCard>
            <div className="p-4 text-center space-y-3">
              <div className="text-base font-black" style={{ color: VS.deep }}>Sign in to play the bots</div>
              <TealButton size="lg" block onClick={exitGuest}>SIGN IN</TealButton>
            </div>
          </VsCard>
        ) : (
          <>
            {/* BOT OF THE DAY — today's day-host character (D2), in its own color. */}
            <VsCard accent={bodPersona.color}>
              <div className="flex items-center justify-between gap-2" style={{ padding: '8px 12px 0' }}>
                <span className="text-[10.5px] font-black uppercase" style={{ color: darken(bodPersona.color, 0.35), letterSpacing: 1.2 }}>Bot of the Day</span>
                <span className="text-[10px] font-extrabold uppercase" style={{ color: VS.label, letterSpacing: 0.6 }}>Same bot, same puzzle for everyone</span>
              </div>
              {/* BJ7: a smaller host, the text column top-aligned beside it. */}
              <div className="flex items-start gap-2" style={{ padding: '4px 12px 8px 6px' }}>
                <BotFigure id={bodPersona.id} pose={botOfDayPose(bodResult)} size={80} />
                <div className="flex-1 min-w-0 space-y-1 pt-1">
                  <div className="font-black leading-tight" style={{ fontSize: 20, color: VS.deep }}>{bod.name}</div>
                  <div className="text-[11.5px] font-extrabold" style={{ color: '#4b5563' }}>{bod.tier} · {bod.line}</div>
                  {bodLine && <BotSpeech text={bodLine} accent={bodPersona.color} />}
                </div>
              </div>
              <div className="flex items-center gap-3" style={{ padding: '0 12px 10px' }}>
                {p.botOfDayStreak > 0 ? (
                  <span className="flex items-center gap-1" aria-label={`${p.botOfDayStreak} ${p.botOfDayStreak === 1 ? 'day' : 'days'} in a row`}>
                    <Icon3D name="flame" size={20} />
                    <SoftNum size={20}>{p.botOfDayStreak}</SoftNum>
                    <span className="text-[11px] font-black" style={{ color: VS.deep }}>{p.botOfDayStreak === 1 ? 'day' : 'days'} in a row</span>
                  </span>
                ) : null}
                <span className="flex-1" />
                {bodResult === 'open' ? (
                  <TealButton icon="play" onClick={() => play('daily')}>Play {bod.name}</TealButton>
                ) : (
                  <span className="px-3 py-1.5 text-[12px] font-black rounded-full" style={{ ...vsCard(bodResult === 'won' ? VS_ACCENT : '#64748b', { radius: 999, shadow: false }), color: bodResult === 'won' ? VS.ink : '#475569' }}>
                    {todayTileLine(bodResult, bod.name, bod.name, false)}
                  </span>
                )}
              </div>
            </VsCard>

            {/* THE LADDER — ten cast bots, three wins in a row per rung. */}
            <SectionLabel right={
              <span className="flex items-center gap-1 text-[11px] font-black" style={{ color: VS.deep, letterSpacing: 0.4 }}>
                <Icon3D name="flame" size={15} /> STREAK <SoftNum size={14}>{p.streak}</SoftNum> · BEST <SoftNum size={14}>{p.bestStreak}</SoftNum>
              </span>
            }>The ladder</SectionLabel>
            {cleared >= LADDER_BOTS.length ? (
              // The whole ladder cleared: the celebration + the ladder trophy.
              <VsCard accent="#7c3aed">
                <div className="flex flex-col items-center gap-1 px-3 pb-3 pt-1">
                  <ArtScene scene="ladder-cleared" height={140} maxWidthPct={70} />
                  <span className="flex items-center gap-1.5 text-[15px] font-black uppercase" style={{ color: '#4c1d95', letterSpacing: 0.5 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={medalSrc('trophy')} alt="" aria-hidden="true" width={30} height={30} loading="lazy" style={{ width: 30, height: 30 }} /> Ladder cleared
                  </span>
                  <span className="text-[11.5px] font-extrabold" style={{ color: '#4b5563' }}>All ten bots beaten. Webster salutes you!</span>
                </div>
              </VsCard>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2" style={vsCard(VS_ACCENT, { radius: 14 })}>
                <SoftNum size={24}>{cleared}<span style={{ fontSize: 15 }}>/{LADDER_BOTS.length}</span></SoftNum>
                <span className="flex-1 min-w-0 text-[11.5px] font-extrabold" style={{ color: '#4b5563' }}>
                  rungs cleared · win {LADDER_CLEAR_RUN} in a row to climb
                </span>
                {/* The prize at the top: the ladder trophy. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={medalSrc('trophy')} alt="" aria-hidden="true" width={28} height={28} loading="lazy" style={{ width: 28, height: 28, opacity: 0.85 }} />
              </div>
            )}
            <ol className="space-y-1.5" aria-label="The ladder">
              {rungs.map((r) => {
                const bot = botRosterEntry(r.id);
                const persona = botPersona(r.id);
                const locked = r.state === 'locked';
                const isNext = r.state === 'next';
                const isCleared = r.state === 'cleared';
                const canPlay = isPro && !locked;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => (isPro ? (canPlay ? play(r.id as CpuKind) : undefined) : router.push('/pro'))}
                      aria-disabled={isPro && !canPlay}
                      aria-label={`${bot.name}, rung ${persona.rung}, ${bot.tier}. ${bot.line}. ${r.line}${isPro ? '' : '. Pro'}`}
                      className="relative w-full flex flex-col text-left overflow-hidden"
                      style={{ ...vsCard(locked ? '#94a3b8' : persona.color, { selected: isNext, radius: 16 }), cursor: canPlay || !isPro ? 'pointer' : 'default' }}
                    >
                      <CardBar accent={locked ? '#94a3b8' : persona.color} height={isNext ? 6 : 4} />
                      {/* BJ7: one top line — rung, bot (40), name and the state top-aligned;
                          ONE detail line (tier line · progress) 4 under the name. */}
                      <span className="flex items-start gap-2.5 px-3 py-2" style={{ opacity: locked ? 0.55 : 1 }}>
                        <SoftNum size={15} style={{ width: 20, textAlign: 'center', paddingTop: 10 }}>{persona.rung}</SoftNum>
                        <span className="relative shrink-0">
                          <BotPoseAvatar id={r.id} pose="ready" accent={persona.color} size={40} faded={locked} />
                          {isCleared && (
                            <span className="absolute -right-1 -bottom-1"><Icon3D name="badge-check" size={20} /></span>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1 text-[14px] font-black truncate" style={{ color: VS.deep }}>
                            {bot.name} · {bot.tier}
                            {/* The boss rung holds the ladder trophy. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {persona.rung === LADDER_BOTS.length && <img src={medalSrc('trophy')} alt="" aria-hidden="true" width={18} height={18} loading="lazy" style={{ width: 18, height: 18 }} />}
                          </span>
                          <span className="block text-[11px] font-extrabold truncate mt-1" style={{ color: '#4b5563' }}>
                            {bot.line} · <span style={{ color: isNext ? darken(persona.color, 0.35) : VS.label }}>{r.line}</span>
                          </span>
                          {isNext && (
                            // The 3-in-a-row progress toward clearing this rung.
                            <span className="flex items-center gap-1 mt-1" aria-hidden="true">
                              {Array.from({ length: LADDER_CLEAR_RUN }, (_, i) => (
                                <span key={i} className="rounded-full" style={{ width: 14, height: 14, background: i < p.ladderRun ? persona.color : '#ffffff', boxShadow: `inset 0 0 0 2px ${persona.color}` }} />
                              ))}
                            </span>
                          )}
                        </span>
                        {!isPro ? (
                          <Icon3D name="lock" size={18} />
                        ) : isNext ? (
                          <span className={candyClass({ color: 'teal', size: 'sm' })} aria-hidden="true"><span className="candy-label">NEXT</span></span>
                        ) : locked ? (
                          <Icon3D name="lock" size={18} />
                        ) : (
                          <span className="text-[10px] font-black" style={{ color: VS.ink, letterSpacing: 0.8 }}>CLEARED</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* YOUR GHOST — your best run, as a faded version of your own letter tile. */}
            {(!isPro || ghost) && (
              <VsCard accent="#64748b">
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <GhostAvatar name={me?.username ?? 'You'} emoji={me?.avatar_emoji} accent={me?.accent_color} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-black" style={{ color: VS.deep }}>Your Ghost</span>
                    <span className="block text-[11px] font-bold truncate mt-1" style={{ color: '#4b5563' }}>
                      {ghost ? `Your best ${modeTitle(mode)}: ${ghost.guessCount} guesses · ${vsClock(ghost.timeMs)}` : 'Race a replay of your best run'}
                    </span>
                  </span>
                  {isPro ? (
                    <SoftPill onClick={() => play('ghost')}>Race it</SoftPill>
                  ) : (
                    <CastButton screen="blue" color="purple" size="sm" onClick={() => router.push('/pro')} icon={<Icon3D name="lock" size={14} />}>Pro</CastButton>
                  )}
                </div>
              </VsCard>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </PageBackground>
  );
}
