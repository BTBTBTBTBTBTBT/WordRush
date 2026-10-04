'use client';

/**
 * The VS lobby (founder-approved VS overhaul, 2026-10-01; spec
 * docs/VS_REDESIGN_SPEC.md §2). Almost nobody is ever waiting live, so every
 * tap ends in a game: the VS banner (today's Daily Battle + Bot of the Day,
 * the record), incoming friend challenges, PLAY (mode strip + LIVE / FRIEND /
 * BOTS), Rivals, your recent challenges and HAVE A CODE?. Free players get the
 * one daily battle, answer challenges and codes for free, and see the Pro card
 * instead of Rivals; guests keep the sign-in card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { VS_MODE_ORDER, vsClock } from '@wordle-duel/core';
import { SoftNum } from '@/components/ui/soft-number';
import { useAuth } from '@/lib/auth-context';
import { lookupInviteByCode, vsHrefForMode } from '@/lib/invite-service';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { useLivePlayerCount } from '@/hooks/use-live-player-count';
import {
  VS, botsTileSub, h2hLine, hoursLeft, incomingLine, ladderNextKind, liveTileSub, loadVsMode, lobbyCount, modeColor,
  modeTitle, recentSent, saveVsMode, sentLabel, sentStatus,
} from '@/lib/vs-lobby';
import { fetchChallenge, fetchVsRivals, type Rival } from '@/lib/vs-challenges-client';
import { botArt, botPersona } from '@/lib/bot/bot-personas';
import { castBotForKind } from '@/lib/adapters/bot-match-service';
import { poseSrc } from '@/lib/art';
import { alphaHex, darken } from '@/lib/soft-surface';
import { BottomNav } from '@/components/ui/bottom-nav';
import { VsBanner } from './vs-banner';
import { NoticeDot, VsNotice } from './vs-notice';
import { NOTICE_COLORS, noticePoses, sentNoticeKind } from './vs-notice-art';
import { useUtcClock, useVsCounts, useVsLobbyData } from './use-vs-lobby';
import { CardBar, InitialAvatar, SectionLabel, SoftPill, TealButton, VS_ACCENT, VS_LIGHT_VARS, VsCard, VsModeIcon, VsModeTile, VsNav, vsCard } from './vs-ui';
import { GameSquare } from '@/components/ui/game-tile';
import { CastLoader } from '@/components/ui/cast-loader';
import { PageBackground } from '@/components/ui/page-background';

const MODES = VS_MODE_ORDER as readonly string[];

export function VsLobby() {
  const router = useRouter();
  const { profile, isProActive, isGuest, exitGuest, loading: authLoading } = useAuth();
  const isPro = isProActive;
  const free = !isPro;
  const data = useVsLobbyData(profile?.id ?? null);
  const clock = useUtcClock();
  const counts = useVsCounts();
  const online = useLivePlayerCount();
  const [mode, setMode] = useState('DUEL');
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  // Read after mount: the play-limit cache is localStorage.
  const [playedLocal, setPlayedLocal] = useState(false);

  useEffect(() => { setMode(loadVsMode(isPro, MODES)); }, [isPro]);
  useEffect(() => { setPlayedLocal(hasPlayedModeToday('vs')); }, []);
  useEffect(() => {
    if (!isPro || !profile?.id) { setRivals([]); return; }
    fetchVsRivals(profile.id, 3).then(setRivals).catch(() => {});
  }, [isPro, profile?.id]);

  const waitingTotal = useMemo(() => Object.values(counts ?? {}).reduce((s, n) => s + (n || 0), 0), [counts]);
  const count = lobbyCount(waitingTotal, online);
  const waitingInMode = counts?.[mode] ?? 0;
  const ladder = data.progression.ladderCleared;
  const dailyPlayed = data.battle.result !== 'open' || playedLocal;
  const latest = data.incoming[0] ?? null;
  const sent = recentSent(data.sent).slice(0, 3);
  // K1 / A7: each notice its own pose (a list never repeats an image).
  const incomingPoses = noticePoses(data.incoming.slice(0, 3).map(() => 'challenge' as const));
  const sentPoses = noticePoses(sent.map((x) => sentNoticeKind(x.results[0]?.outcome)));
  // The BOTS tile shows the ladder's next bot in character (D1); when that is
  // also today's Bot of the Day (pictured in the banner) it takes another pose (A7).
  const nextBot = castBotForKind(ladderNextKind(ladder)) ?? 'webster';
  const botsArt = botArt(nextBot, nextBot === data.botOfDay.botId ? 'waiting' : 'ready');

  const pickMode = (m: string) => {
    if (free && m !== 'DUEL') { router.push('/pro'); return; }
    setMode(m);
    saveVsMode(m);
  };

  const playBotOfDay = () => router.push(`${vsHrefForMode(free ? 'DUEL' : mode)}?cpu=daily`);
  const playBattle = () => router.push('/practice/vs?daily=true');

  const handleJoin = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4 || joining) return;
    setCodeError(null);
    setJoining(true);
    // A challenge code first (race flow), then a live private-match code.
    const ch = await fetchChallenge(c);
    if (ch.ok) { router.push(`/vs/challenge/${c}`); return; }
    const invite = await lookupInviteByCode(c);
    setJoining(false);
    if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) {
      setCodeError(ch.status === 403 ? ch.error : 'No match found for that code.');
      return;
    }
    router.push(`${vsHrefForMode(invite.game_mode)}?inviteCode=${invite.invite_code}`);
  }, [code, joining, router]);

  const signedOut = isGuest && !profile;

  return (
    <PageBackground tint="vs" scheme="light" className="min-h-screen pb-24" style={VS_LIGHT_VARS}>
      {/* BJ7: 12 between sections (was 14). */}
      <div className="max-w-md mx-auto px-4 pt-2 space-y-3">
        <VsNav
          title="VS BATTLE"
          // The whole-cast VS BATTLE title art (docs/ART_SPEC.md §2) replaces the text title and its host.
          art="art-title-vs"
          artLabel="VS Battle"
          onBack={() => router.push('/')}
          right={count && !signedOut ? (
            <span className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: count.live ? VS.ink : VS.label }}>
              <span className={`w-2 h-2 rounded-full ${count.live ? 'animate-pulse' : ''}`} style={{ background: count.live ? '#22c55e' : '#9ca3af' }} />
              {count.text}
            </span>
          ) : null}
        />

        {authLoading ? (
          // Entitlement unknown: show neither the Pro nor the free lobby until we know.
          <div className="flex items-center justify-center py-16">
            <CastLoader />
          </div>
        ) : signedOut ? (
          <VsCard>
            <div className="text-center space-y-3 p-4">
              <div className="text-base font-black" style={{ color: VS.deep }}>Sign in to play VS</div>
              <p className="text-[13px] font-semibold" style={{ color: '#4b5563' }}>
                VS Battle pits you against live opponents, bots and your friends&apos; runs, and records your results. It needs an account.
              </p>
              <TealButton size="lg" block onClick={exitGuest}>SIGN IN</TealButton>
            </div>
          </VsCard>
        ) : (
          <>
            <VsBanner
              name={profile?.username ?? ''}
              battle={data.battle}
              botOfDay={data.botOfDay}
              incoming={latest ? { from: latest.challenger.username, hoursLeft: hoursLeft(latest.expiresAt) } : null}
              streak={data.progression.streak}
              people={data.people}
              bots={data.bots}
              ladder={free ? null : ladder}
              free={free}
              clock={clock}
              onBattle={playBattle}
              onBotOfDay={playBotOfDay}
            />

            {/* Incoming challenges, newest first — K1 notices (teal, the sender's tile, a fitting pose). */}
            {data.incoming.slice(0, 3).map((c, i) => (
              <VsNotice
                key={c.code}
                index={i}
                accent={NOTICE_COLORS.challenge}
                pose={incomingPoses[i]}
                avatar={<InitialAvatar name={c.challenger.username} url={c.challenger.avatarUrl} size={38} />}
                headline={<>Challenge from @{c.challenger.username}</>}
                detail={(
                  <>
                    <span>{modeTitle(c.gameMode)}</span><NoticeDot />
                    {c.run.solved ? (
                      <><span>solved in</span> <SoftNum size={14}>{c.run.guesses}</SoftNum><NoticeDot /><SoftNum size={14}>{vsClock(c.run.timeMs)}</SoftNum></>
                    ) : <span>not solved</span>}
                    <NoticeDot /><span>{hoursLeft(c.expiresAt)}h left</span>
                  </>
                )}
                action="RACE"
                label={`Challenge from @${c.challenger.username}: ${incomingLine(c.gameMode, c.run, c.expiresAt)}. Race.`}
                onClick={() => router.push(`/vs/challenge/${c.code}`)}
              />
            ))}

            {/* PLAY */}
            <SectionLabel right={<span className="text-[11px] font-black uppercase" style={{ color: modeColor(mode), letterSpacing: 0.8 }}>{modeTitle(mode)}</span>}>
              Play
            </SectionLabel>
            <div className="flex justify-between">
              {MODES.map((m) => {
                const on = m === mode;
                const locked = free && m !== 'DUEL';
                const color = modeColor(m);
                return (
                  // Compact square game tile (docs/GAME_TILE_STYLE.md): tint, border and top bar, no label at 34 px.
                  <GameSquare
                    key={m}
                    accent={color}
                    tone="light"
                    selected={on}
                    size={34}
                    glyph={<VsModeIcon mode={m} size={16} color={color} />}
                    onClick={() => pickMode(m)}
                    aria-label={`${modeTitle(m)}${locked ? ' (Pro)' : ''}`}
                    aria-pressed={on}
                    style={{ opacity: locked ? 0.35 : 1 }}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {isPro ? (
                <PlayTile art={poseSrc('c', 'telescope')} title="LIVE" sub={liveTileSub(waitingInMode, mode)} onClick={() => router.push(`${vsHrefForMode(mode)}?live=1`)} />
              ) : (
                <PlayTile
                  art={poseSrc('o2', 'strut')}
                  title="DAILY"
                  sub={dailyPlayed ? 'Played today. Pro plays live any time.' : 'Today’s battle. A bot steps in if nobody is on.'}
                  onClick={playBattle}
                />
              )}
              <PlayTile
                art={poseSrc('o1', 'hug')}
                title="FRIEND"
                locked={free}
                sub={free ? 'Send with Pro. Answering is free.' : 'You play first. They race your run.'}
                onClick={() => router.push(free ? '/pro' : `/vs/friend?mode=${mode}`)}
              />
              <PlayTile
                art={botsArt}
                accent={botPersona(nextBot).color}
                title="BOTS"
                sub={free ? 'Bot of the Day is free. Ladder is Pro.' : botsTileSub(ladder)}
                onClick={() => router.push('/vs/bots')}
              />
            </div>

            {/* RIVALS (Pro) / the Pro card (free). */}
            {isPro ? (
              rivals.length > 0 && (
                <>
                  <SectionLabel right={
                    <CandyButton color="peach" size="sm" onClick={() => router.push('/stats#vs-section')}>See all</CandyButton>
                  }>Rivals</SectionLabel>
                  <VsCard>
                    {rivals.map((r, i) => {
                      const line = h2hLine(r.wins, r.losses, r.lastMode);
                      return (
                        // BJ7: top-aligned row, detail 4 under the name.
                        <div key={r.opponentId} className="flex items-start gap-2.5 px-3 py-2" style={{ borderTop: i === 0 ? undefined : `1px solid ${alphaHex(VS_ACCENT, 0.18)}` }}>
                          <InitialAvatar name={r.username} url={r.avatarUrl} size={36} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-black truncate" style={{ color: '#1f2937' }}>@{r.username}</span>
                            <span className="block text-[11px] font-bold truncate mt-1" style={{ color: line.ahead ? VS.ink : VS.label }}>{line.text}</span>
                          </span>
                          <SoftPill onClick={() => router.push(`/vs/friend?mode=${mode}&friend=${r.opponentId}`)}>Challenge</SoftPill>
                        </div>
                      );
                    })}
                  </VsCard>
                </>
              )
            ) : (
              <VsCard accent="#7c3aed">
              <div className="p-3">
                <div className="flex items-center gap-1.5 text-[15px] font-black" style={{ color: '#4c1d95' }}><Icon3D name="crown" size={20} /> GO PRO FOR ALL OF VS</div>
                <p className="text-[12px] font-bold mt-1" style={{ color: '#4b5563' }}>
                  {/* The VS mode count comes from the catalog, never a literal (sweep-copy guard). */}
                  All {MODES.length} modes, live matches any time, challenge any friend, the bot ladder, rematches and your rivals.
                </p>
                <CastButton screen="blue" color="purple" size="md" className="mt-2" onClick={() => router.push('/pro')}>SEE PRO</CastButton>
              </div>
              </VsCard>
            )}

            {/* YOUR CHALLENGES (sent in the last 24 h) — K1 notices: "@doug beat it" gasps, a held run cheers. */}
            {sent.length > 0 && (
              <>
                <SectionLabel>Your challenges</SectionLabel>
                <div className="space-y-1.5">
                  {sent.map((s, i) => {
                    const status = sentStatus(s);
                    const first = s.results[0];
                    const kind = sentNoticeKind(first?.outcome);
                    return (
                      <VsNotice
                        key={s.code}
                        index={i}
                        accent={NOTICE_COLORS[kind]}
                        pose={sentPoses[i]}
                        avatar={first ? <InitialAvatar name={first.username} size={38} /> : <VsModeTile mode={s.gameMode} size={38} icon={20} />}
                        headline={status}
                        detail={(
                          <>
                            <span>{sentLabel(s)}</span>
                            {first?.solved && (
                              <><NoticeDot /><span>solved in</span> <SoftNum size={14}>{first.guesses}</SoftNum><NoticeDot /><SoftNum size={14}>{vsClock(first.timeMs)}</SoftNum></>
                            )}
                          </>
                        )}
                        action="VIEW"
                        actionColor={kind === 'waiting' ? 'peach' : kind === 'beaten' ? 'pink' : 'purple'}
                        label={`${sentLabel(s)}: ${status}. View.`}
                        onClick={() => router.push(`/vs/challenge/${s.code}`)}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* HAVE A CODE? — a challenge code first, then a live private-match code. */}
            <SectionLabel>Have a code?</SectionLabel>
            <VsCard>
            <div className="p-3">
              <div className="flex gap-2 items-center">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                  placeholder="CODE"
                  aria-label="Challenge or match code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={8}
                  className="flex-1 min-w-0 px-3 py-2 text-[15px] font-black outline-none"
                  // A1: the input takes the teal wash too.
                  // BJ7: a soft filled field, no outline.
                  style={{ letterSpacing: 3, background: `linear-gradient(${alphaHex(VS_ACCENT, 0.16)}, ${alphaHex(VS_ACCENT, 0.16)}), #ffffff`, borderRadius: 12, color: VS.deep }}
                />
                <TealButton onClick={handleJoin} disabled={code.trim().length < 4 || joining}>
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Joining" /> : 'JOIN'}
                </TealButton>
              </div>
              {codeError && <p className="text-xs font-bold mt-2" style={{ color: '#dc2626' }}>{codeError}</p>}
            </div>
            </VsCard>
          </>
        )}
      </div>
      <BottomNav />
    </PageBackground>
  );
}

function PlayTile({ art, accent = VS_ACCENT, title, sub, locked, onClick }: {
  /** The tile's character (a cast pose; decorative). */
  art: string; accent?: string; title: string; sub: string; locked?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col text-left overflow-hidden"
      // BJ7: the tile hugs its content (no 124 floor); the grid row keeps the three equal.
      style={vsCard(accent, { radius: 16 })}
    >
      <CardBar accent={accent} />
      {locked && <Icon3D name="lock" size={16} className="absolute top-3.5 right-2" />}
      <span className="flex flex-col items-start gap-1 p-2.5 pt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" aria-hidden="true" width={40} height={40} loading="lazy" draggable={false} style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(59,26,120,0.18))' }} />
        <span className="text-[12px] font-black" style={{ color: accent === VS_ACCENT ? VS.deep : darken(accent, 0.45), letterSpacing: 0.5 }}>{title}</span>
        <span className="font-bold" style={{ fontSize: 10.5, lineHeight: 1.3, color: '#4b5563' }}>{sub}</span>
      </span>
    </button>
  );
}
