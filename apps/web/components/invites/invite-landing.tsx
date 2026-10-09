'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { inviteHeadline, inviteSubline, type InviteCopyInput } from '@wordle-duel/core';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { PageBackground } from '@/components/ui/page-background';
import { GetAppBadges } from '@/components/share/get-app-badges';
import { codeTiles } from '@/lib/invite-screens';
import { LetterTile } from '@/components/game/letter-tile';
import { artSrc, type PoseArtName } from '@/lib/art';
import type { InvitePreview } from '@/lib/invite-preview';
import { acceptHrefFor } from '@/lib/invite-links';

/**
 * The branded landing for wordocious.com/vs/<CODE> and /friend/<CODE> (FRIDAY-QUEUE 9f): the sender's
 * mascot, "<name> challenges you to <GAME>", the race to beat, a big Accept (plays on the web through the
 * existing join / race / referral flow), the App Store / Play badges, and the code small. The code is
 * kept in a cookie (30 days) so it survives the trip to a store and the first sign-up.
 * Installed app: the universal / app link already opened the app before this page rendered.
 */

const CAST_IDS = ['w', 'c', 'i', 'd', 's', 'r', 'u', 'o1', 'o2', 'o3'];

function CastHero({ castId, sender }: { castId: string; sender: string }) {
  const id = CAST_IDS.includes(castId) ? castId : 'w';
  const pose = id === 'w' ? 'point' : 'ready';
  return (
    <div className="flex items-center justify-center gap-4" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-pose-${id}-${pose}` as PoseArtName)} alt="" width={120} height={120} draggable={false} style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <span className="text-3xl font-black" style={{ color: '#f5a524', letterSpacing: -1 }}>VS</span>
      <span
        className="flex items-center justify-center font-black text-white"
        style={{ width: 96, height: 96, borderRadius: 24, fontSize: 64, background: 'linear-gradient(160deg, #fcd34d, #f59e0b)', boxShadow: '0 8px 0 rgba(180,110,0,0.28)' }}
      >
        ?
      </span>
      <span className="sr-only">{sender} versus you</span>
    </div>
  );
}

export function InviteLanding({ preview }: { preview: InvitePreview }) {
  const router = useRouter();
  const ok = preview.status === 'ok';
  const copy: InviteCopyInput = { variant: preview.variant, sender: preview.sender, game: preview.gameTitle, raceLine: preview.raceLine };

  useEffect(() => {
    if (!ok) return;
    try { document.cookie = `wr_invite=${preview.kind}:${preview.code}; max-age=2592000; path=/; SameSite=Lax`; } catch { /* cookies off */ }
  }, [ok, preview.kind, preview.code]);

  const accept = () => router.push(acceptHrefFor(preview));

  return (
    <PageBackground tint="friends" scheme="light">
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 py-8 text-center">
        <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">WORDOCIOUS</h1>

        {ok ? (
          <>
            <CastHero castId={preview.castId} sender={preview.sender} />
            <div className="space-y-1.5 max-w-sm">
              <h2 className="text-[26px] leading-tight font-black" style={{ color: '#3b1a78' }}>{inviteHeadline(copy)}</h2>
              <p className="text-[14px] font-bold" style={{ color: '#6b5a9a' }}>{inviteSubline(copy)}</p>
            </div>
            <div className="w-full max-w-xs space-y-2.5">
              <CandyButton color="purple" size="lg" block icon="play" onClick={accept}>
                {preview.variant === 'friend' ? 'Accept' : 'Accept and play'}
              </CandyButton>
              <p className="text-[12px] font-bold" style={{ color: '#8a7bb0' }}>Plays right here in your browser. No download needed.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-black tracking-wider" style={{ color: '#8a7bb0' }}>OR GET THE APP</p>
              <GetAppBadges />
            </div>
            <div className="flex flex-col items-center gap-1.5" aria-label={`Invite code ${preview.code}`}>
              <div className="flex gap-1">{codeTiles(preview.code).map((c, i) => (
                <LetterTile key={`${i}-${c}`} letter={c} look="correct" pop={false} aria-hidden style={{ width: 28, ['--gt-font' as string]: '16px' } as React.CSSProperties} />
              ))}</div>
              <span className="text-[10px] font-black tracking-wider" style={{ color: '#a99bc9' }}>YOUR INVITE CODE</span>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[24px] font-black" style={{ color: '#3b1a78' }}>
              {preview.status === 'expired' ? 'This invite ran out of time' : preview.status === 'closed' ? 'This invite was already used' : 'This invite is not here anymore'}
            </h2>
            <p className="text-[14px] font-bold max-w-sm" style={{ color: '#6b5a9a' }}>Today&apos;s puzzles are still waiting, and you can start your own challenge any time.</p>
            <CandyLink href="/" color="purple" size="lg" icon="play">Play today&apos;s puzzles</CandyLink>
            <GetAppBadges />
          </>
        )}
      </main>
    </PageBackground>
  );
}
