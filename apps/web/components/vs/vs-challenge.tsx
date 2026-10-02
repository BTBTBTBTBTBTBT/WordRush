'use client';

/**
 * Racing a friend's challenge (VS overhaul §4) — free to answer. Reached from
 * an incoming card, a push (url /vs/challenge/<code>), the lobby's code field
 * or a shared link. Shows the intro (RACE @DOUG'S RUN, the target, START),
 * then the normal VS screen against a ghost of their run. Already raced: the
 * result from the stored numbers. Expired: a simple card. Your own: the
 * results so far.
 */
import { shareCaption } from '@wordle-duel/core';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { vsClock, type GameMode } from '@wordle-duel/core';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { CastLoader } from '@/components/ui/cast-loader';
import { SoftNum } from '@/components/ui/soft-number';
import { useAuth } from '@/lib/auth-context';
import { fetchHeadToHead, type HeadToHeadRecord } from '@/lib/head-to-head';
import { fetchChallenge, fetchVsChallenges, type ChallengeLookup } from '@/lib/vs-challenges-client';
import { VS, modeTitle, raceTarget, sentStatus, type SentChallenge } from '@/lib/vs-lobby';
import { VsGame } from './vs-game';
import { ChallengeResult } from './challenge-result';
import { InitialAvatar, ModeChip, TealButton, VS_LIGHT_VARS, VsCard } from './vs-ui';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES, artSrc } from '@/lib/art';
import { NOTICE_POSES } from './vs-notice-art';
import { PageBackground } from '@/components/ui/page-background';

export function VsChallenge({ code }: { code: string }) {
  const router = useRouter();
  const { user, profile, isProActive, loading } = useAuth();
  const [lookup, setLookup] = useState<ChallengeLookup | null>(null);
  const [mineSent, setMineSent] = useState<SentChallenge | null>(null);
  const [h2h, setH2h] = useState<HeadToHeadRecord | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    fetchChallenge(code).then((r) => {
      if (cancelled) return;
      setLookup(r);
      if (r.ok && r.isMine) {
        fetchVsChallenges().then((c) => { if (!cancelled) setMineSent(c.sent.find((s) => s.code === r.challenge.code) ?? null); });
      }
      if (r.ok && r.entry && profile?.id) fetchHeadToHead(profile.id, r.challenge.challenger.id).then((h) => { if (!cancelled) setH2h(h); }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [code, loading, user, profile?.id]);

  const centered = (node: React.ReactNode) => (
    <PageBackground tint="vs" scheme="light" className="min-h-screen-stable flex items-center justify-center px-5" style={VS_LIGHT_VARS}>
      <VsCard className="w-full max-w-sm text-center"><div className="p-5 space-y-3">{node}</div></VsCard>
    </PageBackground>
  );
  const vsHome = <TealButton size="lg" block onClick={() => router.push('/vs')}>VS Home</TealButton>;

  if (loading || (user && !lookup)) {
    return centered(<div className="flex justify-center"><CastLoader /></div>);
  }
  if (!user) {
    return centered(
      <>
        <div className="text-[16px] font-black" style={{ color: VS.deep }}>Sign in to race</div>
        <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>A friend challenged you to race their Wordocious run. Sign in (or create a free account) to play.</p>
        <CandyLink href={`/?returnTo=${encodeURIComponent(`/vs/challenge/${code}`)}`} color="teal" size="lg" block>Sign in</CandyLink>
      </>,
    );
  }
  if (!lookup || !lookup.ok) {
    return centered(
      <>
        <ArtScene scene={PAGE_SCENES.notFound} />
        <div className="text-[15px] font-black" style={{ color: VS.deep }}>{lookup && !lookup.ok ? lookup.error : 'Challenge not found'}</div>
        {vsHome}
      </>,
    );
  }

  const { challenge, isMine, expired, entry } = lookup;
  const name = challenge.challenger.username;

  if (entry) {
    return (
      <ChallengeResult
        mode={challenge.gameMode}
        outcome={entry.outcome}
        me={{ run: { solved: entry.solved, boardsSolved: entry.boardsSolved, guesses: entry.guesses, timeMs: entry.timeMs, totalBoards: challenge.run.totalBoards }, guessLog: entry.guessLog }}
        them={{ run: challenge.run, guessLog: challenge.run.guessLog, name, avatarUrl: challenge.challenger.avatarUrl }}
        solutions={challenge.run.solutions}
        h2h={h2h}
        xp={null}
        onClose={() => router.push('/vs')}
        onHome={() => router.push('/vs')}
        onChallengeBack={() => router.push(isProActive ? `/vs/friend?mode=${challenge.gameMode}&friend=${challenge.challenger.id}` : '/pro')}
        onShare={() => {
          // FINISH_SPEC S4: the shared fun copy.
          const day = new Date().toISOString().slice(0, 10);
          const text = `${shareCaption(entry.outcome === 'draw' ? 'vsDraw' : entry.outcome === 'win' ? 'vsWin' : 'vsLose', { date: day, game: modeTitle(challenge.gameMode), opp: name })}\nwordocious.com`;
          if (navigator.share) navigator.share({ text }).catch(() => {});
          else navigator.clipboard?.writeText(text).catch(() => {});
        }}
      />
    );
  }

  if (isMine) {
    return centered(
      <>
        <div className="text-[16px] font-black" style={{ color: VS.deep }}>Your challenge</div>
        <ModeChip mode={challenge.gameMode} />
        <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>{raceTarget(challenge.run)} · code {challenge.code}</p>
        <div className="text-left space-y-1.5">
          {mineSent && mineSent.results.length > 0 ? mineSent.results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[12.5px] font-extrabold" style={{ color: '#1f2937' }}>
              <span>@{r.username}</span>
              <span style={{ color: VS.ink }}>{sentStatus({ results: [r] }).replace(`@${r.username} `, '')}</span>
            </div>
          )) : (
            <p className="text-center text-[12.5px] font-bold" style={{ color: VS.label }}>{expired ? 'Nobody raced it in time.' : 'Nobody has raced it yet.'}</p>
          )}
        </div>
        {vsHome}
      </>,
    );
  }

  if (expired) {
    return centered(
      <>
        <div className="text-[16px] font-black" style={{ color: VS.deep }}>This challenge has expired</div>
        {vsHome}
      </>,
    );
  }

  if (started) {
    return <VsGame mode={challenge.gameMode as GameMode} race={challenge} />;
  }

  // The intro card (K1: a tinted teal card, the challenger's tile, a fitting pose, soft numbers).
  return (
    <PageBackground tint="vs" scheme="light" className="min-h-screen-stable flex items-center justify-center px-5" style={VS_LIGHT_VARS}>
      <VsCard className="w-full max-w-sm">
        <div className="flex items-center gap-2.5" style={{ padding: '12px 14px 4px' }}>
          <InitialAvatar name={name} url={challenge.challenger.avatarUrl} size={38} />
          <span className="flex-1 font-black" style={{ fontSize: 16, color: VS.deep, letterSpacing: 0.4 }}>RACE @{name.toUpperCase()}’S RUN</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artSrc(NOTICE_POSES.challenge[0])} alt="" aria-hidden="true" width={56} height={56} draggable={false} style={{ width: 56, height: 56, objectFit: 'contain', margin: '-6px -4px -6px 0' }} />
        </div>
        <div className="space-y-3" style={{ padding: 14 }}>
          <ModeChip mode={challenge.gameMode} />
          {challenge.run.solved ? (
            <div className="flex items-baseline gap-1.5 text-[15px] font-black" style={{ color: VS.deep }} aria-label={raceTarget(challenge.run)}>
              Solved in <SoftNum size={26}>{challenge.run.guesses}</SoftNum> · <SoftNum size={26}>{vsClock(challenge.run.timeMs)}</SoftNum>
            </div>
          ) : (
            <div className="text-[20px] font-black" style={{ color: VS.deep }}>{raceTarget(challenge.run)}</div>
          )}
          <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>Same puzzle. {name}’s pace plays out beside you.</p>
          <TealButton size="lg" block icon="play" onClick={() => setStarted(true)}>Start</TealButton>
          <div className="flex justify-center">
            <CandyButton color="peach" size="sm" onClick={() => router.push('/vs')}>Not now</CandyButton>
          </div>
        </div>
      </VsCard>
    </PageBackground>
  );
}
