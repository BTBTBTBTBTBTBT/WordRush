'use client';

/**
 * Racing a friend's challenge (VS overhaul §4) — free to answer. Reached from
 * an incoming card, a push (url /vs/challenge/<code>), the lobby's code field
 * or a shared link. Shows the intro (RACE @DOUG'S RUN, the target, START),
 * then the normal VS screen against a ghost of their run. Already raced: the
 * result from the stored numbers. Expired: a simple card. Your own: the
 * results so far.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { GameMode } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { fetchHeadToHead, type HeadToHeadRecord } from '@/lib/head-to-head';
import { fetchChallenge, fetchVsChallenges, type ChallengeLookup } from '@/lib/vs-challenges-client';
import { VS, modeTitle, raceTarget, sentStatus, type SentChallenge } from '@/lib/vs-lobby';
import { VsGame } from './vs-game';
import { ChallengeResult } from './challenge-result';
import { InitialAvatar, ModeChip, TealButton, vsCardStyle } from './vs-ui';

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
    <div className="min-h-screen-stable flex items-center justify-center px-5" style={{ backgroundColor: VS.page }}>
      <div className="w-full max-w-sm text-center p-5 space-y-3" style={{ ...vsCardStyle, borderRadius: 16 }}>{node}</div>
    </div>
  );
  const vsHome = <TealButton className="w-full py-3 text-[14px]" onClick={() => router.push('/vs')}>VS Home</TealButton>;

  if (loading || (user && !lookup)) {
    return centered(<Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: VS.ink }} />);
  }
  if (!user) {
    return centered(
      <>
        <div className="text-[16px] font-black" style={{ color: VS.deep }}>Sign in to race</div>
        <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>A friend challenged you to race their Wordocious run. Sign in (or create a free account) to play.</p>
        <Link href={`/?returnTo=${encodeURIComponent(`/vs/challenge/${code}`)}`} className="block">
          <TealButton className="w-full py-3 text-[14px]">Sign in</TealButton>
        </Link>
      </>,
    );
  }
  if (!lookup || !lookup.ok) {
    return centered(
      <>
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
          const text = `I raced ${name}’s ${modeTitle(challenge.gameMode)} run on Wordocious ⚔️\nhttps://wordocious.com/vs`;
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

  // The intro card (frosted, teal).
  return (
    <div className="min-h-screen-stable flex items-center justify-center px-5" style={{ backgroundColor: VS.page }}>
      <div className="w-full max-w-sm overflow-hidden" style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #d5f5ee, #e0f2fe)', boxShadow: '0 4px 14px rgba(15,118,110,0.10)' }}>
        <div className="flex items-center gap-2.5" style={{ padding: '14px 14px 12px', background: 'rgba(255,255,255,0.5)' }}>
          <InitialAvatar name={name} url={challenge.challenger.avatarUrl} size={36} />
          <span className="flex-1 font-black" style={{ fontSize: 16, color: VS.deep, letterSpacing: 0.4 }}>RACE @{name.toUpperCase()}’S RUN</span>
        </div>
        <div className="space-y-3" style={{ padding: 14 }}>
          <ModeChip mode={challenge.gameMode} />
          <div className="text-[20px] font-black" style={{ color: VS.deep }}>{raceTarget(challenge.run)}</div>
          <p className="text-[12.5px] font-bold" style={{ color: '#4b5563' }}>Same puzzle. {name}’s pace plays out beside you.</p>
          <TealButton className="w-full py-3 text-[15px]" onClick={() => setStarted(true)}>Start</TealButton>
          <button type="button" onClick={() => router.push('/vs')} className="w-full text-[12px] font-black" style={{ color: VS.label }}>Not now</button>
        </div>
      </div>
    </div>
  );
}
